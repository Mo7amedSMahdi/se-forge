using Microsoft.EntityFrameworkCore;

namespace Api.Data;

/// <summary>The database. Each feature adds its DbSet and configuration here (skill stack-dotnet).</summary>
public sealed class AppDb(DbContextOptions<AppDb> options) : DbContext(options);
