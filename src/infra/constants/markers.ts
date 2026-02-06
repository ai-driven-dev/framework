/**
 * Universal AIDD marker for all managed content blocks
 * Used by MERGE_TEXT policy to identify and manage plugin-inserted content
 *
 * @example
 * # <AIDD>
 * aidd*
 * docs*
 * # </AIDD>
 */
export const AIDD_MARKER = {
	START: "# <AIDD>",
	END: "# </AIDD>",
} as const;
