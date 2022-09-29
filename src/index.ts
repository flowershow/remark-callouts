import { visit } from 'unist-util-visit'
import { fromMarkdown } from 'mdast-util-from-markdown'
import type { Plugin } from 'unified'
import type { Node, Data, Parent } from 'unist'
import type { Blockquote, Heading, Text, BlockContent } from 'mdast'
import { parse } from 'svg-parser'
import { types } from './types.js'

// escape regex special characters
function escapeRegExp(s: string) {
  return s.replace(new RegExp(`[-[\\]{}()*+?.\\\\^$|/]`, 'g'), '\\$&')
}

// match breaks
const find = /[\t ]*(?:\r?\n|\r)/g

const callouts: Plugin = function (providedConfig?: Partial<Config>) {
  const config: Config = { ...defaultConfig, ...providedConfig }
  const defaultKeywords: string = Object.keys(config.types).map(escapeRegExp).join('|')

  return function (tree) {
    visit(tree, (node: Node, index, parent: Parent<Node>) => {
      // Filter required elems
      if (node.type !== 'blockquote') return

      /** add breaks to text without needing spaces or escapes (turns enters into <br>)
       *  code taken directly from remark-breaks,
       *  see https://github.com/remarkjs/remark-breaks for more info on what this does.
       */
      visit(node, 'text', (node: Text, index: number, parent: Parent) => {
        const result = []
        let start = 0

        find.lastIndex = 0

        let match = find.exec(node.value)

        while (match) {
          const position = match.index

          if (start !== position) {
            result.push({ type: 'text', value: node.value.slice(start, position) })
          }

          result.push({ type: 'break' })
          start = position + match[0].length
          match = find.exec(node.value)
        }

        if (result.length > 0 && parent && typeof index === 'number') {
          if (start < node.value.length) {
            result.push({ type: 'text', value: node.value.slice(start) })
          }

          parent.children.splice(index, 1, ...result)
          return index + result.length
        }
      })

      /** add classnames to headings within blockquotes,
       * mainly to identify when using other plugins that
       * might interfere. for eg, rehype-auto-link-headings.
       */
      visit(node, 'heading', node => {
        const heading = node as Heading
        heading.data = {
          hProperties: {
            className: 'blockquote-heading',
          },
        }
      })

      // styles
      const defaultStyles: object = {
        hProperties: {
          className: 'blockquote',
        },
      }

      const styleNode: object = {
        type: 'element',
        data: {
          hName: 'style',
          hChildren: [
            {
              type: 'text',
              value: styles,
            },
          ],
        },
      }

      // wrap blockquote and styles in a div
      const wrapper = {
        ...node,
        type: 'element',
        tagName: 'div',
        data: {
          hProperties: {},
        },
        children: [styleNode, node],
      }

      parent.children.splice(Number(index), 1, wrapper)

      const blockquote = wrapper.children[1] as Blockquote

      // add default styles
      blockquote.data = { ...defaultStyles }

      // check for callout syntax starts here
      if (blockquote.children.length <= 0 || blockquote.children[0].type !== 'paragraph') return
      const paragraph = blockquote.children[0]

      if (paragraph.children.length <= 0 || paragraph.children[0].type !== 'text') return

      const [t, ...rest] = paragraph.children

      const regex = new RegExp(`^\\[!(?<keyword>(.*?))\\][\t\f ]?(?<title>.*?)$`, 'gi')
      const m = regex.exec(t.value)

      // if no callout syntax, forget about it.
      if (!m) return

      const [keyword, title] = [m.groups?.keyword, m.groups?.title]

      // if there's nothing inside the brackets, is it really a callout ?
      if (!keyword) return

      const isOneOfKeywords: boolean = new RegExp(defaultKeywords).test(keyword)

      if (title) {
        const mdast = fromMarkdown(title.trim()).children[0]
        if (mdast.type === 'heading') {
          mdast.data = {
            ...mdast.data,
            hProperties: {
              className: 'blockquote-heading',
            },
          }
        }
        blockquote.children.unshift(mdast as BlockContent)
      } else {
        t.value = typeof keyword.charAt(0) === 'string' ? keyword.charAt(0).toUpperCase() + keyword.slice(1) : keyword
      }

      const entry: { [index: string]: string } = {}

      if (isOneOfKeywords) {
        if (typeof config?.types[keyword] === 'string') {
          const e = String(config?.types[keyword])
          Object.assign(entry, config?.types[e])
        } else {
          Object.assign(entry, config?.types[keyword])
        }
      } else {
        Object.assign(entry, config?.types['note'])
      }

      let parsedSvg

      if (entry && entry.svg) {
        parsedSvg = parse(entry.svg)
      }

      // create icon and title node wrapped in div
      const titleNode: object = {
        type: 'element',
        children: [
          {
            type: 'element',
            tagName: 'span',
            data: {
              hName: 'span',
              hProperties: {
                style: `color:${entry?.color}`,
              },
              hChildren: parsedSvg?.children ? parsedSvg.children : [],
            },
          },
          {
            type: 'element',
            children: title ? [blockquote.children[0]] : [t],
            data: {
              hName: 'strong',
            },
          },
        ],
        data: {
          ...blockquote.children[0]?.data,
          hProperties: {
            className: `${formatClassNameMap(config.classNameMaps.title)(keyword)} ${
              isOneOfKeywords ? keyword : 'note'
            }`,
            style: `background-color: ${entry?.color}1a;`,
          },
        },
      }

      // remove the callout paragraph from the content body
      if (title) {
        blockquote.children.shift()
      }

      if (rest.length > 0) {
        rest.shift()
        paragraph.children = rest
      } else {
        blockquote.children.shift()
      }

      // wrap blockquote content in div
      const contentNode: object = {
        type: 'element',
        children: blockquote.children,
        data: {
          hProperties: {
            className: 'callout-content',
            style:
              parent.type !== 'root'
                ? `border-right:1px solid ${entry?.color}33;
                border-bottom:1px solid ${entry?.color}33;`
                : '',
          },
        },
      }

      if (blockquote.children.length > 0) blockquote.children = [contentNode] as BlockContent[]
      blockquote.children.unshift(titleNode as BlockContent)

      // Add classes for the callout block
      blockquote.data = config.dataMaps.block({
        ...blockquote.data,
        hProperties: {
          className: formatClassNameMap(config.classNameMaps.block)(keyword),
          style: `border-left-color:${entry?.color};`,
        },
      })
    })
  }
}
export default callouts

export interface Config {
  classNameMaps: {
    block: ClassNameMap
    title: ClassNameMap
  }
  dataMaps: {
    block: (data: Data) => Data
    title: (data: Data) => Data
  }
  types: { [index: string]: string | object }
}

export const defaultConfig: Config = {
  classNameMaps: {
    block: 'callout',
    title: 'callout-title',
  },
  dataMaps: {
    block: data => data,
    title: data => data,
  },
  types: { ...types },
}

type ClassNames = string | string[]
type ClassNameMap = ClassNames | ((title: string) => ClassNames)
function formatClassNameMap(gen: ClassNameMap) {
  return (title: string) => {
    const classNames = typeof gen == 'function' ? gen(title) : gen
    return typeof classNames == 'object' ? classNames.join(' ') : classNames
  }
}

const styles = `
  :root {
    --callout-bg-color: #f2f3f5;
  }

  :root.dark {
    --callout-bg-color: #161616;
  }

  .blockquote, .callout {
    background: #f2f3f5;
    background: var(--callout-bg-color);
    font-style: normal;
    border-radius: 2px;
  }

  .callout {
    padding: 0 !important;
  }

  .callout-title {
    display: flex;
    align-items: center;
    padding:10px;
    gap: 10px;
  }

  .callout-title > strong {
    font-weight: 700;
  }

  .blockquote, .callout-content {
    padding: 10px 20px;
  }

  .blockquote-heading {
    margin: 5px 0 !important;
    padding: 0 !important;
  }

  .blockquote > p,
  .callout-content > p {
    font-weight: normal;
    margin: 5px 0;
  }

  .callout-title p {
    margin: 0
  }

  .callout-title > strong {
    line-height: 1.5;
  }

  .callout p:before, p:after {
    display: none;
  }

  .blockquote > p:before, p:after {
    display: none;
  }
`
