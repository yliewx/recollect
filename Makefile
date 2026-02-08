# define makefile variables

COMPOSE_FILE = -f ./docker-compose.yml
COMPOSE_FILE_DEV = -f ./docker-compose.dev.yml
# ENV_FILE = --env-file ./.env

#------------------------------------------------------------------------

# colours

RED = \033[1;31m
GREEN = \033[1;32m
BROWN = \033[1;33m
END = \033[0m

#------------------------------------------------------------------------

# RULES

all: down up

up:
	@echo "$(GREEN)[ Starting containers... ]$(END)"
	@docker compose $(COMPOSE_FILE) up --build --force-recreate -d

test: down
	@echo "$(GREEN)[ Running tests with dependencies... ]$(END)"
	@docker compose $(COMPOSE_FILE_DEV) up --build --force-recreate -d

down:
	@echo "$(BROWN)[ Stopping and removing containers... ]$(END)"
	@docker compose $(COMPOSE_FILE) down || true

clean: down
	@echo "$(BROWN)[ Removing build cache... ]$(END)"
	@docker builder prune -a -f
	@docker system prune -f

fclean: clean
	@echo "$(BROWN)[ Removing volumes... ]$(END)"
	@docker system prune --volumes -af

re: down up

#------------------------------------------------------------------------

.PHONY: all up down clean fclean re