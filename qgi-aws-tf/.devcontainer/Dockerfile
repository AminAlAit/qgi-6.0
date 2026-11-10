FROM mcr.microsoft.com/devcontainers/python:1-3.13

# Remove broken Yarn APT repository if present (was in universal:2 base image).
# Guard with existence checks so this is a no-op on images that don't have it.
RUN rm -f /etc/apt/sources.list.d/yarn.list \
          /etc/apt/sources.list.d/yarn.list.bak \
          /usr/share/keyrings/yarnkey.gpg \
    && apt-get update -qq
