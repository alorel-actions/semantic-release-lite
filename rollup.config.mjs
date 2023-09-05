import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import {copyPlugin} from "@alorel/rollup-plugin-copy";
import commonjs from "@rollup/plugin-commonjs";
import * as fs from 'node:fs';
import {randomUUID} from 'node:crypto';

const srcInclude = /src[\\/].+\.m?ts$/;
const srcExclude = /node_modules[\\/]/;

export default async function initRollup(cfg) {
  const modules = fs.readdirSync('src/modules', 'utf8');
  const MAIN = randomUUID();
  const watching = cfg.watch === true;

  return {
    input: modules
      .reduce((acc, mod) => {
        acc[mod] = `src/modules/${mod}/index.mts`;
        return acc;
      }, {[MAIN]: 'src/index.mts'}),
    context: 'global',
    moduleContext: 'global',
    output: {
      generatedCode: {
        constBindings: true,
      },
      dir: 'dist',
      format: 'commonjs',
      preserveModules: false,
      sourcemap: false,
      entryFileNames: ({name}) => name === MAIN ? 'release.js' : `${name}/${name}.js`,
      chunkFileNames: '_common/[name].js',
      assetFileNames: '[name][extname]',
    },
    plugins: [
      nodeResolve({
        exportConditions: [
          'es2015',
          'module',
          'import',
          'default',
        ],
        mainFields: [
          'es2015',
          'esm2015',
          'module',
          'browser',
          'main',
        ],
      }),
      {
        name: 'json-loader',
        transform(code, id) {
          if (id.endsWith('.json')) {
            return {code: `export default ${code}`, map: {mappings: ''}};
          }
        }
      },
      typescript({
        exclude: srcExclude,
        include: srcInclude,
        noEmitOnError: true,
        // compilerOptions: {
        //   sourceMap: watching,
        // }
      }),
      commonjs({
        exclude: ['.js', '.ts'],
        include: [/node_modules/, /^polyfill-node\.[^.]+\.js$/],
        mainFields: ['fesm2015', 'es2015', 'esm2015', 'module', 'main'],
      }),
      !watching && process.env.NODE_ENV !== 'dev' && (await import('@alorel/rollup-plugin-threaded-terser')).threadedTerserPlugin({
        terserOpts: {
          enclose: (args => `${args}:${args}`)([
            'require',
            'Reflect',
            'console',
            'Object',
            'Error',
            'JSON',
            'Math',
            'process',
            'TypeError',
            'undefined',
            'Symbol',
          ].join(',')),
          ecma: 2020,
          toplevel: true,
        },
      }),
      copyPlugin({
        copy: [
          {from: 'action.yml', opts: {glob: {cwd: 'src'}}},
          'LICENSE',
          ...modules.map(mod => ({
            from: `${mod}/action.yml`,
            opts: {glob: {cwd: 'src/modules'}},
          }))
        ],
        defaultOpts: {
          emitNameKind: 'fileName',
        },
        watch: watching,
      }),
    ],
    watch: {
      exclude: 'node_modules/**/*',
    },
    onLog(level, log, handler) {
      if (log.code === 'CIRCULAR_DEPENDENCY' && log.message.includes('node_modules/@actions/core/lib/core.js')) {
        return;
      }

      handler(level, log);
    },
  }
}
