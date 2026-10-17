# Google Workspace automations

Google Workspace MCP v1.1.0 exposes 30 tools across Gmail, Calendar, Tasks, Docs, Drive, Sheets and Slides.

## Project architecture document

1. Select the active project in PIHU.
2. Say: “PIHU, create a Google Doc about this project’s architecture.”
3. PIHU reads a bounded source snapshot (60 files, depth 5, approximately 100 KB total; large files and dependency/build directories are skipped).
4. The model drafts an evidence-based document with relative source paths and unknowns.
5. Edit the title and content in the voice overlay preview. Nothing is uploaded during drafting.
6. Click **Create Google Doc**, then use the returned link to open the document.

The preview is synchronized between PIHU and its native voice overlay. A Google MCP version check prevents uploading content through the older title-only tool. Partial creation failures return the existing document link rather than encouraging duplicate creation.

## Automation examples

- Read a Google Doc and append a project status update.
- Create a spreadsheet, add status rows, and create a meeting to discuss it.
- Create a presentation and add title/body slides from project findings.
- Upload a reviewed text report into a new Drive folder.
- Update or complete Google Tasks based on a reviewed project plan.

## Account setup

Reconnect Google after updating to grant the added Drive file, Sheets and Slides scopes. The Google Cloud project must enable Docs, Drive, Sheets, Slides, Calendar, Tasks and Gmail APIs for their corresponding tools. The `drive.file` scope allows management of files created by or explicitly authorized for PIHU; it does not grant write access to every existing Drive file. Existing Docs text and Sheets cells are retrieved through their respective APIs/scopes.

Deletion and file sharing tools require explicit confirmation. Drive deletion moves files to Trash rather than permanently deleting them. Sheets writes use RAW values so cell content is not interpreted as formulas. Scheduled/background execution is not introduced by this feature; these are interactive, model-orchestrated tool chains.

Google Keep is not included. Full rich document rendering, charts, arbitrary binary uploads, and offline Google API execution are not implemented.
