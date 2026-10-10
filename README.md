# MiniMax Usage Indicator

GNOME Shell extension that shows the **MiniMax API coding-plan quota**
(5h interval + weekly window) in the top bar. Designed for GNOME 45–50.

![indicator](icons/minimax-symbolic.svg)

## Features

- Top-bar indicator that turns **green / yellow / red** as your quota fills up
- In-extension popover with used/total/reset-time for both windows
- Auto-refresh on a configurable interval (60–3600 s)
- API key stored in **GNOME Keyring** (libsecret), never on disk
- Settings: refresh interval, which window to show, countdown toggle
- Headless-friendly: works on X11 and Wayland

## Prerequisites

On Debian / Ubuntu:

```bash
sudo apt install gnome-shell-extensions libgnome-keyring-dev zip libglib2.0-bin gettext
```

`python3` is required by `build.sh` and is pre-installed on most systems.
`gettext` is only needed to compile translations (the extension works
without it; the user-facing strings simply fall back to English).

## Install

```bash
git clone https://github.com/<your-username>/minimax-usage-indicator.git
cd minimax-usage-indicator
./build.sh
gnome-extensions install --force minimax-usage-indicator@local.shell-extension.zip
gnome-extensions enable minimax-usage-indicator@local
```

Then open the extension's preferences and paste your MiniMax API key. The key
is stored in **GNOME Keyring** via Secret.Service; it never lands in dconf or
on disk.

## Click behavior

- **Left-click** on the indicator → refreshes quota and toggles a small
  in-extension popover below the icon with used/total/reset-time for both
  windows. Click again to close it.
- **Middle-click** on the indicator → opens Preferences.
- **Escape** or **click outside** dismisses the popover.

## Configuration

Open the extension's Preferences (middle-click the indicator, or
`gnome-extensions prefs minimax-usage-indicator@local`):

| Setting | Default | Description |
|---|---|---|
| API Key | — | Your MiniMax API key (stored in Keyring) |
| Refresh interval | 300 s | How often to fetch the quota (60–3600 s) |
| Primary window | Auto | Which window the top-bar label tracks |
| Show countdown | on | Show `· Hh Mm` after the percentage |
| Show weekly | on | Show weekly window in the popover |

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
- [ ] Disable network for 30 s; popover shows the error key, last top-bar value preserved, shell does not crash
- [ ] `journalctl /usr/bin/gnome-shell -f` during the run is free of unhandled exceptions

## Unit tests

```bash
node --test test_modules/
```

## Translations

The extension uses GNU gettext. The `po/` directory contains one
`.po` file per language. The build compiles them to `.mo` files in
`locale/<lang>/LC_MESSAGES/minimax-usage-indicator.mo` and bundles
them in the extension zip, so translations work for end users
without any extra setup on their system.

**Currently shipped:** English, Portuguese (Brazil), Spanish, French,
German, Italian.

### Adding a new language

You do not need to touch any JavaScript. The workflow:

1. Copy the template:
   ```bash
   cp po/minimax-usage-indicator.pot po/<lang>.po
   ```
   Use the [BCP 47 / GNU locale code](https://www.gnu.org/software/gettext/manual/html_node/Language-Codes.html)
   for the filename — `pt_BR.po` for Brazilian Portuguese, `zh_CN.po`
   for Simplified Chinese, `en_GB.po` for British English, etc.
2. Open the new `.po` in any PO editor
   ([POedit](https://poedit.net/), [Gtranslator](https://gitlab.gnome.org/GNOME/gtranslator),
   or a plain text editor) and translate every `msgid`. Keep
   `{pct}`, `{h}`, `{m}`, `{sec}`, `{status}`, `{used}`, `{total}`,
   `{reset}`, `{color}`, `{model}` exactly as written — they are
   placeholders that get substituted in JS.
3. Set the `Language:` header to your language code and adjust
   `Plural-Forms` if your language has more than two plural forms
   (Polish, Russian, Arabic, …). Defaults from the GNU gettext
   reference cover most languages.
4. Open a PR with just the new `.po` file. The build script picks
   it up automatically.

### Updating the template

If you add or reword a translatable string in the JavaScript code,
regenerate the template so translators can sync their `.po` files:

```bash
./scripts/update-pot.sh
```

Commit the resulting `po/minimax-usage-indicator.pot`. The same
script is what your reviewers will run on PRs to verify nothing was
missed.

### How strings are wrapped

- `_('simple text')` — straight lookup, no placeholders.
- `_f('Quota at {pct}%', { pct: 42 })` — translation with named
  placeholders. The `.po` keeps the `{name}` tokens; JS substitutes
  them in. This avoids the `printf %s` style that translators
  commonly get wrong.
- `_n('one error', '{n} errors', n)` — plural forms. Not used yet,
  but the header in every `.po` already declares the right
  `Plural-Forms` rule for the language so adding plural strings
  later is a one-line change.

## Data source

- Endpoint: `GET https://www.minimax.io/v1/api/openplatform/coding_plan/remains`
- Auth: `Authorization: Bearer <apiKey>`
- Documented in
  [`rubenvieira/minimax-quota-bar`](https://github.com/rubenvieira/minimax-quota-bar).

## Compatibility

Tested on GNOME 45 through GNOME 50.1. The popover is hand-rolled with
`St.Widget` + `Clutter.BoxLayout` to avoid the `PopupMenu` class
introspection issues seen on some patched GNOME 50 builds. HTTP requests
go through `Soup.Session` (canonical extension path) rather than GJS's
built-in `fetch`, which has historically been unreliable inside shell
extensions.

## Contributing

Issues and pull requests welcome on GitHub. Please run `node --test test_modules/`
before submitting. Translation PRs are especially appreciated — see
the [Translations](#translations) section above; no JavaScript changes
are needed to add a language.

## License

[MIT](LICENSE) © 2026 MiniMax Usage Indicator contributors
