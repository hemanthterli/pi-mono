# Multimodal Feature Implementation (Image Support)

## Phase 1: Frontend UI & Event Handling
- [x] Add HTML container above the chat input box to hold image thumbnails (hidden by default).
- [x] Add CSS styling for the image thumbnail container (e.g., small preview, remove 'X' button).
- [x] Implement a `paste` event listener on the `window` or `document` to intercept clipboard items.
- [x] Implement a function to read the pasted `File` object using `FileReader` as a Base64 Data URL.
- [x] Display the Base64 Data URL as an `<img>` tag in the thumbnail container.
- [x] Add functionality to clear/remove the attached image before sending.
- [x] Add an image expansion modal (pop-up) when clicking on image thumbnails to view them larger.

## Phase 2: Communication & WebSocket Payload
- [x] Update the `Enter` keypress logic: when sending a message, check if there is an attached image.
- [x] Modify the JSON payload sent via WebSocket. Change from `{"message": "text"}` to a structured payload: `{"message": "text", "images": ["data:image/png;base64,..."]}`.
- [x] Update the `appendUserMessage` function in the UI so that if an image is sent, it is rendered inside the user's chat bubble as an `<img>` tag alongside the text.
- [x] Clear the thumbnail container and reset state after a successful send.

# Phase 3: Backend Reception & Storage
- [x] Update the `api.py` WebSocket handler to extract the `images` array from the incoming JSON payload.
- [x] Create an image storage directory (e.g., `~/.pi/sessions/images/`).
- [x] Write a helper function in `api.py` (or `session.py`) that strips the `data:image/...;base64,` header and decodes the Base64 string into raw bytes.
- [x] Save the decoded raw bytes to the local filesystem with a unique filename (e.g., `uuid4() + .png`).

## Phase 4: Provider-Agnostic AI Integration & History Management
- [x] Modify `session_manager.append()` to support multimodal inputs. Instead of just accepting a text string, it should accept structured data saving the *local file path* of the saved image.
- [x] Refactor `api.py` to be LLM-agnostic: pass a generic `content_list` (`[{"type": "text", "text": "..."}, {"type": "image", "path": "..."}]`) instead of provider-specific types.
- [x] Update `gemini.py` adapter to read local image paths, convert them to raw bytes, and structure them as `types.Part.from_bytes(...)`.
- [x] Update `openai.py` adapter to read local image paths, encode them to Base64, and structure them as `{"type": "image_url", "image_url": ...}`.
- [x] Update `session_manager.load()` in `session.py` to natively parse JSON arrays for multimodal history content.

## Phase 5: Testing & Cleanup
- [ ] Test pasting a single image and asking a question about it.
- [ ] Test asking a follow-up question (Turn 2) to ensure the history/context is maintained.
- [ ] Restart the Extension Host to ensure the `session.jsonl` correctly reloads the image from disk and restores the multimodal context.
- [ ] Ensure the UI handles scrolling gracefully when large image bubbles are appended.