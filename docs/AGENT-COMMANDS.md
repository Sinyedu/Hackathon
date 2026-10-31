# DockProof agent: commands

Say them (tap the mic, or just say **"Hey agent…"** on any page) or type them in the agent box.
Wording is flexible; these are the phrases that always work. The first matching row wins.

## Wake up
| Say | What happens |
|---|---|
| "Hey agent" | Jumps to the Agent page, answers "Yes boss?", your next sentence is the request |
| "Hey agent, what is missing?" | Jumps to the Agent page and runs the request |

Hands-free listening needs `localhost` or HTTPS and microphone permission.

## Add documents
| Say | What happens |
|---|---|
| "Attach a file" / "Upload" / "Add a document" | Opens this device's file picker (tap **Choose files** if the browser blocks it) |
| "Scan a document" / "Take a photo" / "Camera" | Opens the camera on a phone |
| "Attach file: name.pdf" | Imports that file from the backend's `imports/` folder by name, otherwise opens the picker |
| "Import both" | Imports one purchase order and one delivery note from `imports/` |
| "Import the delivery note" / "Import the purchase order" | Imports that file from `imports/` |
| "My files" / "What files" | Opens the picker |

Name files with **order / purchase / PO** or **delivery / dispatch / DN** so the agent knows which is which. If it can't tell, it asks.

## See the analysis
| Say | What happens |
|---|---|
| "Show me the documents" / "Show the comparison" / "Side by side" | Opens the side-by-side view with problems marked |
| "Show the purchase order" / "Show the delivery note" / "Open the PDF" | Opens that original file |
| "Catch me up" / "Summary" / "Status" | Reads the summary aloud |
| "What is missing?" / "Any problems?" | Reads the findings |
| "Elaborate" / "Tell me more" / "Explain" | Opens and reads the main finding |
| "Elaborate on the evidence" / "…the claim" / "…the review" | Opens and reads that briefing window |

## Act
| Say | What happens |
|---|---|
| "Find a replacement" | Finds the best supplier and shows a card with a link |
| "Open the replacement link" / "Where can I buy it" | Opens that link (tap the button if the browser blocks the pop-up) |
| "Approve" | Asks you to tap **Confirm approval**; the agent never approves by voice alone |
| "Export" / "Download the briefing" | Downloads the briefing as a Markdown file |

## Test deliveries
| Say | What happens |
|---|---|
| "Make a test delivery" / "Generate a test delivery" | Opens Test deliveries; printing one switches back to the agent, which reads it |

## Anything else
Any other sentence is sent to the local model as a question about the current delivery ("Which supplier do you recommend?"). Answers come from the scanned text only; check the linked scans for anything important.

## Not by voice
- Choosing the product for a line the matcher couldn't settle (the **Which product is this?** card)
- Answering **Same product?** yes or no
- Confirming an approval
