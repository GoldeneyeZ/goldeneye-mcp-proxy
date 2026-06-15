export interface MigrationOptions {
    dryRun: boolean;
}
export interface MigrationResult {
    changed: boolean;
    message: string;
    skillsPath: string;
    codexSkillsPath?: string;
    agentsSkillsPath?: string;
    deferredPath: string;
}
export declare class SkillMigrationService {
    private readonly codexTarget;
    private readonly agentsTarget;
    constructor(homeDir?: string);
    deferCodexSkills(options: MigrationOptions): MigrationResult;
    deferAgentsSkills(options: MigrationOptions): MigrationResult;
    restoreCodexSkills(options: MigrationOptions): MigrationResult;
    restoreAgentsSkills(options: MigrationOptions): MigrationResult;
    private defer;
    private restore;
    private result;
}
