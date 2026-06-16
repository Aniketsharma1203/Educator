# conftest.py — shared pytest fixtures and DB setup

import pytest
import os
import sys

# Make sure backend module is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
