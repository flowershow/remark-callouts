import { visit } from 'unist-util-visit'
import type { Plugin } from 'unified'
import type { Data } from 'unist'
import type { Blockquote, Heading } from 'mdast'
import { parse } from 'svg-parser'
import { types } from './types.js'

 // escape regex special characters
function escapeRegExp(s: String) {
  return s.replace(new RegExp(`[-[\\]{}()*+?.\\\\^$|/]`, 'g'), '\\$&');
}

// match breaks
const find = /[\t ]*(?:\r?\n|\r)/g

const callouts: Plugin = function (providedConfig?: Partial<Config>) {
  const config: Config = { ...defaultConfig, ...providedConfig }
  const defaultKeywords: string = Object.keys(config.types)
   .map(escapeRegExp)
   .join('|');

  return function (tree) {
    visit(tree, (node: any, index, parent: {[index: string]: any}) => {
      // Filter required elems
      if (node.type !== 'blockquote') return

      /** add breaks to text without needing spaces or escapes (turns enters into <br>)
       *  code taken directly from remark-breaks,
       *  see https://github.com/remarkjs/remark-breaks for more info on what this does. 
      */
      visit(node, 'text', (node: any, index, parent) => {
        const result = []
        let start = 0

        find.lastIndex = 0

        let match = find.exec(node.value)

        while (match) {
          const position = match.index

          if (start !== position) {
            result.push({type: 'text', value: node.value.slice(start, position)})
          }

          result.push({type: 'break'})
          start = position + match[0].length
          match = find.exec(node.value)
        }

        if (result.length > 0 && parent && typeof index === 'number') {
          if (start < node.value.length) {
            result.push({type: 'text', value: node.value.slice(start)})
          }

          parent.children.splice(index, 1, ...result)
          return index + result.length
        }
      })

      /** add classnames to headings within blockquotes,
       * mainly to identify when using other plugins that
       * might interfere. for eg, rehype-auto-link-headings.
      */
      visit(node, 'heading', (node) => {
        const heading = node as Heading
        heading.data = {
          hProperties: {
            className: 'blockquote-heading'
          }
        }
      })

      // styles
      let defaultStyles: any = {
        hProperties: {
          className: 'blockquote'
        }
      }

      let styleNode: any = {
        type: 'element',
        data: {
          hName: 'style',
          hChildren: [{
            type: 'text',
            value: styles
          }]
        },
      }

      // wrap blockquote and styles in a div
      const wrapper: any = {
        ...node,
        type: 'element',
        tagName: 'div',
        data: {
          hProperties: {}
        },
        children: [styleNode, node]
      }

      parent.children.splice(index, 1, wrapper)


      const blockquote: {[index: string]: any} = wrapper.children[1] as Blockquote

      // add default styles
      blockquote.data = defaultStyles

      // check for callout syntax starts here
      if (blockquote.children.length <= 0 || blockquote.children[0].type !== 'paragraph') return
      const paragraph = blockquote.children[0]

      if (paragraph.children.length <= 0 || paragraph.children[0].type !== 'text') return

      const [t, ...rest] = paragraph.children

      const regex = new RegExp(`^\\[!(?<keyword>(.*))\\][\t\f ]?(?<title>.*?)$`, 'gi')
      const m = regex.exec(t.value)

      // if no callout syntax, forget about it.
      if (!m) return

      const [keyword, title] = [m.groups?.keyword, m.groups?.title]

      // if there's nothing inside the brackets, is it really a callout ?
      if (!keyword) return

      // update content if it's within the same paragraph
      if (rest.length > 0) {
        // remove first <br> element
        rest.splice(0,1)
        paragraph.children = rest
      } else {
        // remove the p tag if its empty
        blockquote.children.splice(0,1)
      }

      const isOneOfKeywords = new RegExp(defaultKeywords).test(keyword)

      const formattedTitle: string = 
        title?.trim() || (typeof keyword.charAt(0) === 'string' 
          ? keyword.charAt(0).toUpperCase() + keyword.slice(1) 
          : keyword
        )

      const entry: {[index: string]: Object | string} = 
        isOneOfKeywords ? config?.types[keyword] : config?.types['note'] // default to note style

      const settings: {[index: string]: any} = typeof entry === 'string' ? config?.types[entry]: entry

      let parsedSvg

      if (settings && settings.svg) {
        parsedSvg = parse(settings.svg)
      }

      // create icon and title node wrapped in div
      let titleNode: any = {
        type: 'element',
        children: [
          {
            type: 'element',
            tagName: 'span',
            data: {
              hName: 'span',
              hProperties: {
                style: `color:${settings?.color}`
              },
              hChildren: parsedSvg?.children ? parsedSvg.children : []
            }
          },
          {
            type: 'element',
            tagName: 'strong',
            data: {
              hName: 'strong',
              hChildren: [{
                type: 'text',
                value: formattedTitle
              }]
            }
          }
        ],
        data: {
          ...blockquote.children[0]?.data,
          hProperties: {
            className: formatClassNameMap(config.classNameMaps.title + ' ' + (isOneOfKeywords ? keyword : 'note'))(keyword),
            style: `background-color: ${settings?.color}1a;`
          },
        }
      }
      
      // wrap blockquote content in div
      let contentNode: any = {
        type: 'element',
        children: blockquote.children,
        data: {
          hProperties: {
            className: 'callout-content',
            style: parent.type !== 'root' 
              ? `border-right:1px solid ${settings?.color}33;
                border-bottom:1px solid ${settings?.color}33;`
              : ''
          },
        }
      }

      blockquote.children = [titleNode]

      if (rest.length > 0 ) blockquote.children.push(contentNode)
      
      // Add classes for the callout block
      blockquote.data = config.dataMaps.block({
        ...blockquote.data,
        hProperties: {
          className: formatClassNameMap(config.classNameMaps.block)(keyword),
          style: `border-left-color:${settings?.color};`,
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
  },
  types: { [index: string]: any }
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
  types: { ...types }
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

  .callout-content > .blockquote-heading {
    margin: 5px 0 0 0 !important;
    padding: 0 !important;
  }

  .blockquote > p, .callout-content > p {
    font-weight: normal;
    margin: 5px 0;
  }

  .blockquote > p:before, p:after {
    display: none;
  }

  .callout-content > p:before, p:after {
    display: none;
  }
`