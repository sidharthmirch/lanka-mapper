/** @type {import('next').NextConfig} */
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const pagesBasePath = process.env.GITHUB_ACTIONS && repoName ? `/${repoName}` : '';

const nextConfig = {
  output: 'export',
  basePath: pagesBasePath,
  assetPrefix: pagesBasePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: pagesBasePath,
  },
};

export default nextConfig;
