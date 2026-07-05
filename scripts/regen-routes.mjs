import { Generator, getConfig } from '@tanstack/router-generator';
const config = await getConfig({
  routesDirectory: './src/routes',
  generatedRouteTree: './src/routeTree.gen.ts',
});
const gen = new Generator({ config, root: process.cwd() });
await gen.run();
console.log('regenerated routeTree.gen.ts');
