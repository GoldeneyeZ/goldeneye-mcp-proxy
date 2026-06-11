export interface StatusHolder {
    getConnectedServers: () => string[];
    getToolCount: (server: string) => number;
    getTotalTools: () => number;
    getConfigPath: () => string;
    getLastReloadTimestamp: () => number;
    isPendingReload: () => boolean;
    getProjects: () => Array<{
        name: string;
        path: string;
    }>;
    getDefaultProject: () => string | null;
}
