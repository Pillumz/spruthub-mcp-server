FROM node:22-alpine

WORKDIR /app

# Prevent npm from generating unnecessary files
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false

# Copy package files
COPY package.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy source files
COPY src ./src

# Create non-root user
RUN adduser --disabled-password --gecos "" appuser && chown -R appuser:appuser /app
USER appuser

# Default to SSE mode for Docker
ENV PORT=8000
ENV HOST=0.0.0.0

EXPOSE 8000

# Run in SSE mode by default
CMD ["node", "src/index.js", "sse"]
