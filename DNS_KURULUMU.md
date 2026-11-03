# KentBağ e-posta alan adı doğrulaması

Hostinger → lollore.com → DNS kayıtları bölümünde aşağıdaki üç kaydı ekle. Mevcut MX, SPF veya diğer kayıtları silme/değiştirme. TTL otomatik kalabilir.

## TXT · resend._domainkey

Ad: resend._domainkey

Değer:

```text
p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCsj1p+2Z67i2fIc66tmGf+QXEhO8cD/Mpfn1DNa+xu8txI314hyrH5pVn8066fFczVrRMF6eupiF4OfqcTK0bhWlJPSGeLCdW4fRuGDqsOL7wjy5YmupHM1TFJaz329y1Y2man/6FBPmYOtJrPxMjbWyxYDT1bdf8JqQevERkyhwIDAQAB
```

## CNAME · rsend

Ad: rsend

Değer:

```text
rsend-euw1.forge.rmta.net
```

## CNAME · send

Ad: send

Değer:

```text
send.forge.rmta.net
```

Kaydettikten sonra burada haber ver; Resend doğrulamasını başlatacağım. Bunlar açık DNS kayıtlarıdır, parola/API anahtarı içermez.
