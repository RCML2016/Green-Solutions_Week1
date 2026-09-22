class ConnectorError(Exception):
    """Base connector exception."""


class ValidationError(ConnectorError):
    """A source record violates the canonical contract."""


class MappingNotFound(ConnectorError):
    """A required asset, tag, or entity mapping is unavailable."""


class TransientSourceError(ConnectorError):
    """A retryable source-system failure."""

