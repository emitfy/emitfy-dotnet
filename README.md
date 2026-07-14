# Emitfy (.NET)

Official Emitfy API SDK for .NET.

```bash
dotnet add package Emitfy
```

```csharp
using Emitfy;

var emitfy = new EmitfyClient(
    Environment.GetEnvironmentVariable("EMITFY_API_KEY")!,
    Environment.GetEnvironmentVariable("EMITFY_API_SECRET")!
);

await emitfy.Webhooks.CreateAsync(new {
    url = "https://seu-sistema.com/webhooks/emitfy",
    events = new { invoice = new[] { "nfse.authorized" }, cte = Array.Empty<string>() }
});

var company = emitfy.Company(Environment.GetEnvironmentVariable("EMITFY_COMPANY_ID")!);
await company.Nfse.CreateAsync(new { serviceDescription = "Serviço", amount = 100 });
```

Docs: https://api.emitfy.com/docs/sdks
