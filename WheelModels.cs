// ============================================================
//  WheelModels.cs — 幸运转盘 · C# 数据模型
// ============================================================
//  与 index.html 中 JS 端的类型一一对应，供后续开发
//  ASP.NET 后端接口 / WPF 桌面版复用。
//
//  设计要点（与 JS 端同一套类型安全策略）：
//  - record 类型：不可变（init-only），天然线程安全；
//  - 工厂方法 TryCreate 返回 Result 模式，失败不抛异常，
//    与 JS 端 createItem / createTheme 的 { ok, error } 语义一致；
//  - 不变式集中在工厂里校验：权重 > 0 且 ≤ 100、名称 1~30 字、
//    颜色 ≥ 2 且 ≤ 12、格式 #RRGGBB —— 与 JS 端规则逐条一致。
// ============================================================

using System.Text.Json.Serialization;

namespace DecisionWheel.Models;

/// <summary>Result 模式：成功携带值，失败携带错误信息。对应 JS 端的 Result。</summary>
public readonly record struct Result<T>(bool Ok, T? Value, string? Error)
{
    public static Result<T> Success(T value) => new(true, value, null);
    public static Result<T> Fail(string error) => new(false, default, error);

    /// <summary>解构用法：var (ok, value, error) = result;</summary>
    public void Deconstruct(out bool ok, out T? value, out string? error)
        => (ok, value, error) = (Ok, Value, Error);
}

/// <summary>转盘选项。对应 JS 端 WheelItem。</summary>
public sealed record WheelItem(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("weight")] double Weight)
{
    public const int MaxNameLength = 30;
    public const double MaxWeight = 100;

    /// <summary>校验并构造。输入不可信（来自用户/网络），必须走此入口。</summary>
    public static Result<WheelItem> TryCreate(string? name, double weight)
    {
        var trimmed = name?.Trim();
        if (string.IsNullOrEmpty(trimmed) || trimmed.Length > MaxNameLength)
            return Result<WheelItem>.Fail($"选项名必须是 1~{MaxNameLength} 个字符");
        if (!double.IsFinite(weight) || weight <= 0)
            return Result<WheelItem>.Fail("权重必须是大于 0 的数字");
        if (weight > MaxWeight)
            return Result<WheelItem>.Fail($"权重不能超过 {MaxWeight}");
        return Result<WheelItem>.Success(new WheelItem(GenerateId("item"), trimmed, weight));
    }

    internal static string GenerateId(string prefix)
        => $"{prefix}_{DateTime.Now.Ticks.ToString("x")}_{Guid.NewGuid().ToString("N")[..6]}";
}

/// <summary>转盘主题。对应 JS 端 WheelTheme。</summary>
public sealed record WheelTheme(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("colors")] IReadOnlyList<string> Colors,
    [property: JsonPropertyName("builtin")] bool Builtin)
{
    public const int MinColors = 2;
    public const int MaxColors = 12;

    public static Result<WheelTheme> TryCreate(string? name, IEnumerable<string>? colors, bool builtin = false)
    {
        var trimmed = name?.Trim();
        if (string.IsNullOrEmpty(trimmed) || trimmed.Length > 20)
            return Result<WheelTheme>.Fail("主题名必须是 1~20 个字符");

        var list = colors?.ToList() ?? new List<string>();
        if (list.Count < MinColors)
            return Result<WheelTheme>.Fail($"主题至少需要 {MinColors} 种颜色");
        if (list.Count > MaxColors)
            return Result<WheelTheme>.Fail($"主题颜色最多 {MaxColors} 种");
        foreach (var c in list)
        {
            if (!System.Text.RegularExpressions.Regex.IsMatch(c, "^#[0-9a-fA-F]{6}$"))
                return Result<WheelTheme>.Fail($"颜色格式不正确：{c}，需要 #RRGGBB");
        }
        return Result<WheelTheme>.Success(new WheelTheme(
            WheelItem.GenerateId("theme"), trimmed, list.AsReadOnly(), builtin));
    }
}

/// <summary>应用状态。对应 JS 端 WheelState。</summary>
public sealed record WheelState(
    [property: JsonPropertyName("items")] IReadOnlyList<WheelItem> Items,
    [property: JsonPropertyName("themeId")] string ThemeId,
    [property: JsonPropertyName("removeWinner")] bool RemoveWinner)
{
    public const int MinItems = 2;
    public const int MaxItems = 100;

    /// <summary>加权随机选取（与 JS 端 pickWinner 同算法）。</summary>
    public WheelItem PickWinner(Random rng)
    {
        double total = 0;
        foreach (var it in Items) total += it.Weight;
        double roll = rng.NextDouble() * total;
        foreach (var it in Items)
        {
            roll -= it.Weight;
            if (roll < 0) return it;
        }
        return Items[^1];
    }

    public static Result<WheelState> Validate(IReadOnlyList<WheelItem>? items, string? themeId, bool removeWinner)
    {
        if (items is null || items.Count < MinItems)
            return Result<WheelState>.Fail($"选项数量必须 ≥ {MinItems}");
        if (items.Count > MaxItems)
            return Result<WheelState>.Fail($"选项最多 {MaxItems} 个");
        if (string.IsNullOrEmpty(themeId))
            return Result<WheelState>.Fail("themeId 缺失");
        return Result<WheelState>.Success(new WheelState(items, themeId, removeWinner));
    }
}
