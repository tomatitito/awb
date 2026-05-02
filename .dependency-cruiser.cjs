/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-node-builtins-in-web',
      severity: 'error',
      comment: 'Browser-rendered code in src/web must not import Node.js built-in modules; Vite externalizes them and the UI can crash at runtime.',
      from: {
        path: '^src/web/',
      },
      to: {
        dependencyTypes: ['core'],
      },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
    reporterOptions: {
      dot: {
        collapsePattern: 'node_modules/[^/]+',
      },
    },
  },
}
