# Historical Events

Historical context events are loaded from:
- `public/events.json`

They are displayed in:
- desktop person detail panel timeline
- mobile person detail timeline

## JSON Schema

Each event object must include:

```json
{
  "name": "English label",
  "name_zh": "Chinese label",
  "start_year": 1850,
  "end_year": 1864
}
```

## Edit Rules

- `start_year` and `end_year` must be integers.
- `start_year` must be less than or equal to `end_year`.
- Keep both `name` and `name_zh` populated for bilingual UI.
- Keep top-level shape as `{ "events": [...] }`.

## Add Event Example

```json
{
  "name": "Example Reform Period",
  "name_zh": "示例改革时期",
  "start_year": 1990,
  "end_year": 1995
}
```

## Test After Editing

1. Save `public/events.json`.
2. Run `npm run dev`.
3. Open a person with birth/death dates that overlap your event range.
4. Verify event appears in timeline chips on desktop and mobile.
