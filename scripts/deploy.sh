#!/bin/bash
# Production deployment script for FairPass
# This script is used to deploy the application to a production server

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DEPLOY_DIR="/opt/fairpass"
COMPOSE_FILE="docker-compose.prod.yml"
BACKUP_DIR="/opt/fairpass/backups"
LOG_FILE="/var/log/fairpass-deploy.log"

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root"
    fi
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
    fi
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error "Docker Compose is not installed"
    fi
}

# Create backup
backup_database() {
    log "Creating database backup..."
    mkdir -p "$BACKUP_DIR"
    
    # Get current timestamp
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/fairpass_$TIMESTAMP.sql"
    
    # Backup database
    docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U fairpass fairpass > "$BACKUP_FILE"
    
    # Compress backup
    gzip "$BACKUP_FILE"
    
    log "Database backup created: $BACKUP_FILE.gz"
    
    # Keep only last 7 backups
    cd "$BACKUP_DIR"
    ls -t fairpass_*.sql.gz | tail -n +8 | xargs -r rm --
}

# Pull new images
pull_images() {
    log "Pulling new Docker images..."
    docker compose -f "$COMPOSE_FILE" pull
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    docker compose -f "$COMPOSE_FILE" run --rm web pnpm -F @fairpass/api db:migrate
}

# Restart services
restart_services() {
    log "Restarting services..."
    docker compose -f "$COMPOSE_FILE" up -d --force-recreate
}

# Wait for health checks
wait_for_health() {
    log "Waiting for health checks..."
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:3000/api/trpc/health &> /dev/null && \
           curl -f http://localhost:8000/health &> /dev/null; then
            log "All services are healthy"
            return 0
        fi
        
        echo -n "."
        sleep 2
        ((attempt++))
    done
    
    error "Health checks failed after $max_attempts attempts"
}

# Verify deployment
verify_deployment() {
    log "Verifying deployment..."
    
    # Check if services are running
    docker compose -f "$COMPOSE_FILE" ps
    
    # Check health endpoints
    if curl -f http://localhost:3000/api/trpc/health &> /dev/null; then
        log "Web app health check passed"
    else
        error "Web app health check failed"
    fi
    
    if curl -f http://localhost:8000/health &> /dev/null; then
        log "AI Engine health check passed"
    else
        error "AI Engine health check failed"
    fi
}

# Cleanup old images
cleanup() {
    log "Cleaning up old Docker images..."
    docker image prune -f
}

# Main deployment function
deploy() {
    log "Starting deployment..."
    
    check_root
    check_docker
    
    cd "$DEPLOY_DIR"
    
    # Create backup before deployment
    backup_database
    
    # Pull new images
    pull_images
    
    # Run migrations
    run_migrations
    
    # Restart services
    restart_services
    
    # Wait for health checks
    wait_for_health
    
    # Verify deployment
    verify_deployment
    
    # Cleanup
    cleanup
    
    log "Deployment completed successfully!"
}

# Rollback function
rollback() {
    log "Starting rollback..."
    
    check_root
    check_docker
    
    cd "$DEPLOY_DIR"
    
    # Find the last backup
    LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/fairpass_*.sql.gz 2>/dev/null | head -n 1)
    
    if [ -z "$LATEST_BACKUP" ]; then
        error "No backup found for rollback"
    fi
    
    log "Restoring from backup: $LATEST_BACKUP"
    
    # Decompress backup
    gunzip -k "$LATEST_BACKUP"
    BACKUP_FILE="${LATEST_BACKUP%.gz}"
    
    # Restore database
    docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U fairpass fairpass < "$BACKUP_FILE"
    
    # Remove decompressed backup
    rm "$BACKUP_FILE"
    
    # Restart services
    restart_services
    
    # Wait for health checks
    wait_for_health
    
    # Verify deployment
    verify_deployment
    
    log "Rollback completed successfully!"
}

# Parse command line arguments
case "${1:-deploy}" in
    deploy)
        deploy
        ;;
    rollback)
        rollback
        ;;
    *)
        echo "Usage: $0 {deploy|rollback}"
        exit 1
        ;;
esac
