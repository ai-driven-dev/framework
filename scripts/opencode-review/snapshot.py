#!/usr/bin/env python3
"""Extract bounded, untrusted PR context without executing or following archive links."""

import gzip
import os
from pathlib import Path
import sys
import tarfile

MAX_BYTES = 64 * 1024 * 1024
MAX_FILES = 10_000
MAX_ENTRIES = 20_000
MAX_ARCHIVE_BYTES = 80 * 1024 * 1024
SENTINEL = '.aidd-context-incomplete'
EXCLUDED_DIRS = {'.opencode', '.agents', '.claude', '.review-input'}
EXCLUDED_FILES = {'AGENTS.md', 'CLAUDE.md', 'opencode.json', 'opencode.jsonc', SENTINEL}


class ArchiveLimit(Exception):
    pass


class LimitedReader:
    """Bound decompressed tar bytes as well as bytes written to disk."""

    def __init__(self, stream, limit):
        self.stream = stream
        self.remaining = limit

    def read(self, size=-1):
        size = self.remaining + 1 if size < 0 else min(size, self.remaining + 1)
        data = self.stream.read(size)
        if len(data) > self.remaining:
            raise ArchiveLimit('decompressed archive exceeds limit')
        self.remaining -= len(data)
        return data


def extract(archive, destination, *, max_bytes=MAX_BYTES, max_files=MAX_FILES,
            max_entries=MAX_ENTRIES, max_archive_bytes=MAX_ARCHIVE_BYTES):
    dest = Path(destination)
    if dest.is_symlink() or (dest.exists() and (not dest.is_dir() or any(dest.iterdir()))):
        raise ValueError('destination must be a new or empty directory')
    dest.mkdir(parents=True, exist_ok=True)
    root = None
    count = total = entries = 0
    reason = None
    try:
        with open(archive, 'rb') as source, gzip.GzipFile(fileobj=source) as decompressed:
            with tarfile.open(fileobj=LimitedReader(decompressed, max_archive_bytes), mode='r|') as tar:
                for member in tar:
                    entries += 1
                    if entries > max_entries:
                        reason = 'archive entry limit reached'
                        break
                    name = member.name.rstrip('/')
                    parts = name.split('/')
                    if not name or name.startswith('/') or '\\' in name or any(p in ('', '.', '..') for p in parts):
                        reason = reason or 'unsafe archive path omitted'
                        continue
                    if root is None:
                        root = parts[0]
                    if parts[0] != root:
                        reason = reason or 'unexpected archive root omitted'
                        continue
                    relative = parts[1:]
                    if not relative:
                        if not member.isdir():
                            reason = reason or 'archive root is not a directory'
                        continue
                    if any(p in EXCLUDED_DIRS or p.startswith('.env') for p in relative) or relative[-1] in EXCLUDED_FILES:
                        continue
                    if member.isdir():
                        continue
                    if not member.isfile():
                        reason = reason or 'archive link or special file omitted'
                        continue
                    if count >= max_files or member.size > max_bytes - total:
                        reason = 'snapshot size or file limit reached'
                        break
                    content = tar.extractfile(member)
                    if content is None:
                        reason = 'archive file is unreadable'
                        break
                    data = content.read(member.size + 1)
                    if len(data) != member.size:
                        reason = 'archive file is incomplete'
                        break
                    target = dest.joinpath(*relative)
                    target.parent.mkdir(parents=True, exist_ok=True)
                    # O_EXCL and O_NOFOLLOW reject duplicates and symlink destinations.
                    fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, 'O_NOFOLLOW', 0), 0o600)
                    with os.fdopen(fd, 'wb') as output:
                        output.write(data)
                    count += 1
                    total += len(data)
    except (ArchiveLimit, tarfile.TarError, EOFError, OSError, ValueError) as error:
        reason = f'archive extraction stopped: {type(error).__name__}'
    if reason:
        (dest / SENTINEL).write_text(f'Snapshot incomplete: {reason}.\n', encoding='utf-8')
    return {'files': count, 'bytes': total, 'complete': reason is None}


def main():
    if len(sys.argv) != 3:
        print('usage: snapshot.py <archive.tar.gz> <destination>', file=sys.stderr)
        return 2
    try:
        result = extract(sys.argv[1], sys.argv[2])
    except (ValueError, OSError) as error:
        print(f'snapshot: {error}', file=sys.stderr)
        return 1
    print('snapshot: complete' if result['complete'] else 'snapshot: incomplete')
    return 0


if __name__ == '__main__':
    sys.exit(main())
