# One Dockerfile, two targets. `dev`: the SDK, tools, restored packages and source, for Compose (the source
# is mounted over /app, `dotnet watch` applies changes or restarts) and for CI (the gate runs in it). The
# last stage is the production image: published with the SDK, run on the ASP.NET runtime image as its
# non-root user. No secrets in either image.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS dev
WORKDIR /app
# Mounted folders do not raise file events reliably; dotnet watch polls (its documented setting for containers).
ENV DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 DOTNET_USE_POLLING_FILE_WATCHER=1 DOTNET_WATCH_RESTART_ON_RUDE_EDIT=1
COPY dotnet-tools.json Users.slnx ./
COPY src/Users.Api/Users.Api.csproj src/Users.Api/
COPY tests/Users.Api.Tests/Users.Api.Tests.csproj tests/Users.Api.Tests/
RUN dotnet tool restore && dotnet restore Users.slnx
COPY . .
EXPOSE 8080
CMD ["dotnet", "watch", "--project", "src/Users.Api", "--non-interactive", "run", "--no-launch-profile"]

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY src/Users.Api/Users.Api.csproj src/Users.Api/
RUN dotnet restore src/Users.Api/Users.Api.csproj
COPY src/ src/
RUN dotnet publish src/Users.Api/Users.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "Users.Api.dll"]
