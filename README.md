# MiniMax Usage Indicator

GNOME Shell extension that shows the **MiniMax API coding-plan quota**
(5h interval + weekly window) in the top bar.

## Prerequisites

On Debian / Ubuntu:

```bash
sudo apt install gnome-shell-extensions libgnome-keyring-dev zip libglib2.0-bin
```

`python3` is required by `build.sh` and is pre-installed on most systems.

## Install

```bash
./build.sh
gnome-extensions install --force minimax-usage-indicator@local.shell-extension.zip
gnome-extensions enable minimax-usage-indicator@local
```

## API key

Open the extension's preferences and paste your MiniMax API key. The key is
stored in **GNOME Keyring** via Secret.Service; it never lands in dconf or
on disk.

## Click behavior

- **Left-click** on the indicator → refreshes quota and toggles a small
  in-extension popover below the icon with used/total/reset-time for both
  windows. Click again to close it.
- **Middle-click** on the indicator → opens Preferences.
- **Escape** or **click outside** dismisses the popover.

## Smoke test checklist

Run this before tagging a release.

- [ ] `./build.sh` succeeds
- [ ] `gnome-extensions install --force *.shell-extension.zip` succeeds
- [ ] `gnome-extensions enable minimax-usage-indicator@local` succeeds
- [ ] Top bar shows `⚙` after enable
- [ ] Preferences opens; paste API key; Save
- [ ] Within one refresh interval the label becomes `XX% · Hh Mm`
- [ ] Left-click shows a popover under the icon with used / total and reset time for both windows
- [ ] Click outside or Escape closes the popover
- [ ] Middle-click opens Preferences
- [ ] "Refresh Now" updates the label immediately
- [ ] Disable network for 30s; popover shows the error key, last top-bar value preserved, shell does not crash
- [ ] `journalctl /usr/bin/gnome-shell -f` during the run is free of unhandled exceptions

## Unit tests

```bash
node --test test_modules/
```

## Data source

- Endpoint: `GET https://www.minimax.io/v1/api/openplatform/coding_plan/remains`
- Auth: `Authorization: Bearer <apiKey>`
- Documented in
  [`rubenvieira/minimax-quota-bar`](https://github.com/rubenvieira/minimax-quota-bar).
