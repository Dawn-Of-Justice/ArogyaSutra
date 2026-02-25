declare module 'next-pwa' {
    import type { NextConfig } from 'next';
    function withPWA(config: {
        dest: string;
        disable?: boolean;
        register?: boolean;
        skipWaiting?: boolean;
    }): (nextConfig: NextConfig) => NextConfig;
    export default withPWA;
}
