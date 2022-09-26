# remark-callouts

Remark plugin to add support for blockquote-based callouts/admonitions similar to Obsidian style.

## What is this ?

Using Obsidian, when we type in the following syntax `> [!tip]` inside a blockquote it would render them as a callout.
See https://help.obsidian.md/How+to/Use+callouts for more.

## Features supported

- [x] Supports blockquote obsidian style callouts
- [x] Supports nested blockquote callouts
- [x] Supports 13 types with appropriate styling in default theme
- [x] Supports aliases for types
- [x] Defaults to note style callout for all other types eg. `> [!xyz]`
- [x] Supports dark and light mode styles

Future support:
- [ ] Support custom types and icons
- [ ] Support custom aliases
- [ ] Support Foldable callouts
- [ ] Support custom styles

## Geting Started

### Installation

```bash
npm install remark-callouts
```

### Usage

```js
import callouts from 'remark-callouts'

await remark()
  .use(remarkParse)
  .use(callouts)
  .use(remarkRehype)
  .use(rehypeStringify)
  .process(`\
> [!tip]
> hello callout
`)
```

HTML output

```js
<div>
  <style>...</style>
  <blockquote class="callout">
    <div class="callout-title">
      <span><svg>...</svg></span>
      <strong>Tip</strong>
    </div>
    <div class="callout-content">
      <p>hello callout</p>
    </div>
  </blockquote>
</div>
```

### Supported Types

- note
- tip `aliases: hint, important`
- warning `alises: caution, attention`
- abstract `aliases: summary, tldr`
- info
- todo
- success `aliases: check, done`
- question `aliases: help, faq`
- failure `aliases: fail, missing`
- danger `alias: error`
- bug
- example
- quote `alias: cite`

## License

MIT
