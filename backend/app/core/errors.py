class ServiceError(Exception):
    """A safe, user-facing error from an application service."""

    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(message)
