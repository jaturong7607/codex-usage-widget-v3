# Publication review

Only the V3 standard and V3 mascot variants are included. The Windows V2 relay, installation status, original workspace notes, private network configuration and personal screenshots are excluded.

The release folder was checked for personal account names, email addresses, Windows user paths, private device addresses, private network hostnames, login callback URLs and known locally stored OAuth credentials. No such values were found in the publication files.

The source includes the public Codex OAuth client identifier and OpenAI endpoint URLs needed for authentication. These are application configuration, not user credentials. Test tokens and account identifiers are synthetic fixtures.

No CLI `auth.json`, access token, refresh token, relay token, encrypted credential backup, or runtime cache is included. Ignore rules help exclude common credential files, but new changes must still be reviewed before publication.

Do not publish the parent development workspace or reuse this review as proof that future changes contain no secrets. Review the actual staged diff before each push.
