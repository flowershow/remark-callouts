import resolve from '@rollup/plugin-node-resolve';
import typescript from "@rollup/plugin-typescript";
import postcss from 'rollup-plugin-postcss'
import { terser } from 'rollup-plugin-terser';
;
const external = [
  /mdast-util-from-markdown/,
  /svg-parser/,
  /unist-util-visit/
];

export default [
  {
    input: ["./src/index.ts", "./src/styles.css"],
    external: external,
    output: {
      dir: "dist",
      format: "esm",
    },
    plugins: [
      typescript({
        tsconfig: "./tsconfig.build.json",
        declaration: true,
        declarationDir: 'dist'
      }),
      postcss({
        extract: "styles.css",
        minimize: true
      }),
      resolve(),
      terser()
    ]
  },
];
