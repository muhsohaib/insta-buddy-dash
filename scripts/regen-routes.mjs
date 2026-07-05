import { generator, getConfig } from '@tanstack/router-generator';
const config = await getConfig({ 
  routesDirectory: './src/routes',
  generatedRouteTree: './src/routeTree.gen.ts',
});
await generator(config, process.cwd());
console.log('regenerated routeTree.gen.ts');
