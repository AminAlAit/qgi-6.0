FROM mcr.microsoft.com/devcontainers/universal:2

# Remove broken Yarn APT repository — its GPG key (62D54FD4003F6525) is expired/rotated,
# causing `apt-get update` to fail with NO_PUBKEY and breaking any devcontainer feature
# that runs apt-get during install. Yarn is already present in the base image binary, so
# removing the apt source loses nothing.
RUN rm -f /etc/apt/sources.list.d/yarn.list \
          /etc/apt/sources.list.d/yarn.list.bak \
          /usr/share/keyrings/yarnkey.gpg \
    && apt-get update -qq
