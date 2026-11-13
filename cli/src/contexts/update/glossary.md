# Update glossary

The language of the `update` context. A name in the code means what this page says.

| Term | Meaning | In the code |
| --- | --- | --- |
| Release | The latest published version of the CLI, with the notes of its GitHub tag when they can be read | `CliRelease`, `CliReleaseSource` |
| Decision | What `aidd update` does given the installed version, the latest release and the flags: report, preview, install or nothing | `UpdateDecision`, `decideUpdate` |
| Flags | `--check` only reports, `--dry-run` previews, `--force` installs although nothing newer exists | `UpdateFlags` |
| Notice | The two lines warning that a newer release exists, shown from what the last check kept | `noticeFor`, `PrintUpdateNotice` |
| Check entry | What the last check learned: when it ran and the latest version it saw | `CheckEntry` |
| Check cache | Where the check entry is kept between two runs, beside the other disposable files, with the older location still read | `UpdateCheckCache` |
| Refresh | Asking for the latest release and keeping the answer for the next run's notice | `RefreshUpdateCheck` |
| Installer | What replaces the installed CLI, through the package manager that owns the `aidd` found on the path | `CliInstaller`, `packageManagerOf` |
