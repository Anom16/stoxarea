"""
core/logging_config.py
Structured logging configuration untuk production-ready observability.
"""

import json
import logging
from datetime import datetime
from pythonjsonlogger import jsonlogger


class JSONFormatter(jsonlogger.JsonFormatter):
    """Custom JSON formatter dengan timestamp dan structured fields"""
    
    def add_fields(self, log_record, record, message_dict):
        super(JSONFormatter, self).add_fields(log_record, record, message_dict)
        
        # Add timestamp (ISO format)
        log_record['timestamp'] = datetime.utcnow().isoformat() + 'Z'
        
        # Add service info
        log_record['service'] = 'stoxarea-backend'
        
        # Add environment info
        log_record['logger_name'] = record.name
        log_record['level'] = record.levelname
        log_record['module'] = record.module
        log_record['function'] = record.funcName
        log_record['line'] = record.lineno
        
        # Add exception info if present
        if record.exc_info:
            log_record['exception'] = self.formatException(record.exc_info)


def setup_structured_logging(log_level=logging.INFO):
    """Setup structured JSON logging untuk semua loggers"""
    
    # Root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    
    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Console handler dengan JSON formatter
    console_handler = logging.StreamHandler()
    console_handler.setLevel(log_level)
    
    # Format: JSON per line
    json_formatter = JSONFormatter('%(timestamp)s %(level)s %(message)s')
    console_handler.setFormatter(json_formatter)
    root_logger.addHandler(console_handler)
    
    # File handler untuk backup (optional)
    try:
        file_handler = logging.FileHandler('logs/stoxarea.json', encoding='utf-8')
        file_handler.setLevel(log_level)
        file_handler.setFormatter(json_formatter)
        root_logger.addHandler(file_handler)
    except FileNotFoundError:
        # logs/ directory doesn't exist
        pass
    
    return root_logger


def get_logger(name: str) -> logging.Logger:
    """Get logger dengan structured logging enabled"""
    return logging.getLogger(name)


# Usage example:
# In main.py:
#   from app.core.logging_config import setup_structured_logging
#   setup_structured_logging()
#
# In any module:
#   from app.core.logging_config import get_logger
#   logger = get_logger(__name__)
#   logger.info("User registered", extra={"user_id": 123, "email": "user@example.com"})
#
# Output (JSON per line):
# {"timestamp": "2026-05-25T10:30:45.123456Z", "level": "INFO", "message": "User registered", "service": "stoxarea-backend", "user_id": 123, "email": "user@example.com", ...}
