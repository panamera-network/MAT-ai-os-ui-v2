# adapters

Everything that talks to the outside world lives behind an interface here.
A `VisionApiAdapter` interface will describe what the UI needs; a `rest/`
implementation will call the real VISION API
(`MAT-AI-OS-V2/api`, same endpoints the existing `MAT-AI-OS-ui` uses), and a
`mock/` implementation will serve fixtures for UI development without a
running backend. Screens depend on the interface, never on `fetch` directly.
