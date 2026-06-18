#!/bin/bash

# run_tests.sh
# Run this script before executing `git push` to ensure all tracking and logic works!

echo "🚀 Running Automated Backend Tests..."

# We execute pytest inside the running educator-api-1 container so it has access to Redis/DB.
# If the container isn't running, this will fail and warn you.
docker exec educator-api-1 pytest tests/ -v

if [ $? -eq 0 ]; then
    echo "✅ All tests passed! You are safe to push your code."
    exit 0
else
    echo "❌ Tests failed! Please fix the errors above before pushing."
    exit 1
fi
