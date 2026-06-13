export interface MigrationOptions {
    dryRun: boolean;
}
export interface MigrationResult {
    changed: boolean;
    message: string;
    codexSkillsPath: string;
    deferredPath: string;
}
export declare class SkillMigrationService {
    private readonly codexSkillsPath;
    private readonly deferredPath;
    constructor(homeDir?: string);
    deferCodexSkills(options: MigrationOptions): MigrationResult;
    restoreCodexSkills(options: MigrationOptions): MigrationResult;
    private result;
}
