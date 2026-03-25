/**
 * Custom error classes for the MuBrowser Scheduler.
 * Helps in identifying and handling specific failure modes like permissions or storage issues.
 */

class SchedulerError extends Error {
    constructor(message, code = 'SCHEDULER_ERROR') {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}

class PermissionError extends SchedulerError {
    constructor(path) {
        super(
            `Permission denied: Cannot access or write to "${path}". Please try running the application as Administrator.`,
            'E_PERMISSION_DENIED'
        );
        this.path = path;
    }
}

class StorageError extends SchedulerError {
    constructor(operation, path, originalError) {
        super(
            `Storage failure during ${operation} at "${path}": ${originalError.message}`,
            'E_STORAGE_FAILURE'
        );
        this.path = path;
        this.operation = operation;
        this.originalError = originalError;
    }
}

class ValidationError extends SchedulerError {
    constructor(message, field) {
        super(message, 'E_VALIDATION_ERROR');
        this.field = field;
    }
}

class JobNotFoundError extends SchedulerError {
    constructor(jobId) {
        super(`Job with ID "${jobId}" was not found.`, 'E_JOB_NOT_FOUND');
        this.jobId = jobId;
    }
}

module.exports = {
    SchedulerError,
    PermissionError,
    StorageError,
    ValidationError,
    JobNotFoundError
};
