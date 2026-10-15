using Microsoft.EntityFrameworkCore;
using Users.Api.Users;

namespace Users.Api.Data;

public sealed class AppDb(DbContextOptions<AppDb> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<User>(e =>
        {
            e.Property(u => u.Email).HasMaxLength(254);
            e.Property(u => u.DisplayName).HasMaxLength(100);
            e.Property(u => u.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(u => u.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
            e.HasIndex(u => u.Email).IsUnique();
            e.HasIndex(u => new { u.CreatedAt, u.Id }).IsDescending(true, true); // the list order
            e.ToTable(t => t.HasCheckConstraint("CK_Users_Status", "[Status] IN ('ACTIVE', 'SUSPENDED')"));
        });
    }
}
