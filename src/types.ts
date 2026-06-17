export interface CheckovCheck {
    check_id: string;
    check_name: string;
    resource: string;
    file_path: string;
    repo_file_path: string;
}

export interface CheckovResults {
    results: {
        passed_checks: CheckovCheck[];
        failed_checks: CheckovCheck[];
        skipped_checks: CheckovCheck[];
    };
    summary: {
        passed: number;
        failed: number;
        skipped: number;
    };
}
