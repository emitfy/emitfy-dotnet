# Emitfy

Official Emitfy API SDK for .NET (OpenAPI-typed).

## Install

```bash
dotnet add package Emitfy
```

## Facade

```csharp
using Emitfy;

var emitfy = new EmitfyClient(
  Environment.GetEnvironmentVariable("EMITFY_API_KEY")!,
  Environment.GetEnvironmentVariable("EMITFY_API_SECRET")!
);

var company = emitfy.Company(Environment.GetEnvironmentVariable("EMITFY_COMPANY_ID")!);
await company.Nfse.CreateAsync(new { serviceDescription = "Serviço", amount = 100 });
```

## Typed OpenAPI layer

```csharp
using Emitfy.Generated.Model;

var api = emitfy.WebhooksApi();
await api.WebhooksCreateAsync(new WebhookCreate(
  url: "https://seu-sistema.com/webhooks/emitfy",
  events: new WebhookCreateEvents(...)
));
```

Docs: https://api.emitfy.com/docs/sdks
