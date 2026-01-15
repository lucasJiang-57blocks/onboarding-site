# GitHub Actions 自动部署配置指南

本文档详细说明如何配置 GitHub Actions 来自动部署此项目到 Cloudflare Workers。

## 📋 目录

1. [前置准备](#前置准备)
2. [配置 GitHub Secrets](#配置-github-secrets)
3. [工作流说明](#工作流说明)
4. [部署流程](#部署流程)
5. [故障排查](#故障排查)

## 🔧 前置准备

### 1. 创建 Cloudflare R2 Bucket

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **R2** → **Create bucket**
3. 创建 bucket，名称必须与 `wrangler.toml` 中的 `bucket_name` 一致
   - 当前配置：`57blocks-onboarding-web3`

### 2. 创建 Cloudflare Worker（可选，推荐自动创建）

**重要说明**：Worker 会在首次部署时**自动创建**，你不需要手动创建。但如果你想提前创建或验证配置，可以按以下步骤操作：

#### 方式一：自动创建（推荐）

Worker 会在首次运行 `wrangler deploy` 时自动创建。你只需要：
1. 确保 `wrangler.toml` 中的 `name` 配置正确（当前：`57blocks-onboarding-site`）
2. 确保已配置好所有 GitHub Secrets
3. 推送代码触发部署，Wrangler 会自动创建 Worker

#### 方式二：手动创建（可选）

如果你想提前创建 Worker：

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages** → **Create application**
3. 选择 **Create Worker**
4. 配置：
   - **Name**: `57blocks-onboarding-site`（必须与 `wrangler.toml` 中的 `name` 一致）
   - **HTTP handler**: 默认即可
5. 点击 **Deploy**

**注意**：
- 手动创建的 Worker 必须是空的（不需要添加代码）
- 首次部署时，Wrangler 会覆盖手动创建的 Worker
- 如果 Worker 已存在，Wrangler 会直接更新它

### 3. 创建 R2 API Token（用于上传 MDX 文件）

1. 在 Cloudflare Dashboard 中，进入 **R2** → **Manage R2 API Tokens**
2. 点击 **Create API Token**
3. 配置权限：
   - **Permissions**: `Object Read & Write`
   - **TTL**: 可选，建议设置较长时间
   - **Allow List Operations**: 勾选
4. 创建后，**立即保存**以下信息（只显示一次）：
   - `Access Key ID`
   - `Secret Access Key`

### 4. 创建 Cloudflare API Token（用于部署 Worker）

1. 在 Cloudflare Dashboard 中，点击右上角头像 → **My Profile**
2. 进入 **API Tokens** 标签页
3. 点击 **Create Token**
4. 使用 **Edit Cloudflare Workers** 模板，或自定义权限：
   - **Account**: `Cloudflare Workers:Edit`（必需，用于创建和部署 Worker）
   - **Account**: `Account:Read`（必需，用于读取账户信息）
   - **Zone**: `Zone:Read`（如果使用自定义域名）
5. 创建后，**立即保存** Token（只显示一次）

**权限说明**：
- `Cloudflare Workers:Edit` 权限允许 Wrangler 自动创建、更新和删除 Worker
- 如果 Worker 不存在，Wrangler 会自动创建它
- 如果 Worker 已存在，Wrangler 会更新它

### 5. 获取 Cloudflare Account ID

1. 在 Cloudflare Dashboard 右侧边栏可以看到 **Account ID**
2. 或者进入任意 Worker 页面，URL 中包含 Account ID

## 🔐 配置 GitHub Secrets

### 步骤

1. 进入你的 GitHub 仓库
2. 点击 **Settings** → **Secrets and variables** → **Actions**
3. 点击 **New repository secret**
4. 添加以下所有 Secrets：

### 必需 Secrets 列表

#### 1. Cloudflare 认证相关

| Secret 名称 | 说明 | 如何获取 |
|------------|------|---------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token | 见"前置准备"第3步 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID | Dashboard 右侧边栏 |

#### 2. R2 存储相关

| Secret 名称 | 说明 | 如何获取 |
|------------|------|---------|
| `R2_ACCESS_KEY_ID` | R2 Access Key ID | 见"前置准备"第2步 |
| `R2_SECRET_ACCESS_KEY` | R2 Secret Access Key | 见"前置准备"第2步 |
| `R2_BUCKET` | R2 Bucket 名称 | 与 `wrangler.toml` 中的 `bucket_name` 一致<br>当前值：`57blocks-onboarding-web3` |

#### 3. 应用环境变量（可选，根据项目需求）

| Secret 名称 | 说明 | 是否必需 |
|------------|------|---------|
| `NEXT_PUBLIC_API_URL` | API 服务地址 | 根据项目需求 |
| `NEXT_PUBLIC_CHALLENGE_SECRET` | Challenge 密钥 | 根据项目需求 |
| `NEXT_PUBLIC_CHALLENGE_RPC_ENDPOINT` | Challenge RPC 端点 | 根据项目需求 |
| `NEXT_PUBLIC_MAINNET_RPC_ENDPOINT` | Mainnet RPC 端点 | 根据项目需求 |
| `NEXT_PUBLIC_DEVNET_RPC_ENDPOINT` | Devnet RPC 端点 | 仅预览环境需要 |

### 快速配置脚本

你可以使用以下命令快速检查需要配置的 Secrets：

```bash
# 检查当前工作流中使用的所有 Secrets
grep -r "secrets\." .github/workflows/
```

### 📝 Secret 填写格式

**重要**：每个 Secret 的详细填写格式、示例和注意事项，请参考：
- [GitHub Secrets 填写格式说明](./github-secrets-format.md)

**快速提示**：
- ✅ 直接粘贴值，**不要添加引号**
- ✅ **区分大小写**，Secret 名称必须完全匹配
- ✅ **无空格、无换行符**
- ✅ 创建后无法再次查看，请妥善保存

## 📝 工作流说明

### 工作流文件位置

`.github/workflows/deploy.yaml`

### 触发条件

1. **生产部署**：推送到 `master` 分支时自动触发
2. **预览部署**：推送到其他分支时自动触发
3. **手动触发**：在 GitHub Actions 页面可以手动运行

### 部署流程

#### 生产部署（master 分支）

1. ✅ 检出代码
2. ✅ 安装 pnpm 和 Node.js 24
3. ✅ 恢复构建缓存（Next.js 和 MDX）
4. ✅ 安装依赖
5. ✅ 预编译 MDX 文件
6. ✅ 上传编译后的 MDX 到 R2
7. ✅ 构建 Next.js 应用
8. ✅ **部署到 Cloudflare Workers**
   - 如果 Worker 不存在，Wrangler 会**自动创建**它
   - 如果 Worker 已存在，Wrangler 会更新它
   - Worker 名称来自 `wrangler.toml` 中的 `name` 字段

#### 预览部署（其他分支）

流程与生产部署相同，但：
- 使用预览环境配置（`env.preview`）
- MDX 文件上传到不同的 R2 前缀（基于分支名）
- Worker 名称后缀为 `-preview`

### 分支配置

**注意**：当前工作流配置为 `master` 分支。如果你的默认分支是 `main`，需要修改：

```yaml
# 在 .github/workflows/deploy.yaml 中
deploy:
  if: github.ref == 'refs/heads/master'  # 改为 'refs/heads/main' 如果使用 main 分支
```

## 🚀 部署流程

### 自动部署

1. **推送代码到 GitHub**
   ```bash
   git push origin master  # 或 main
   ```

2. **GitHub Actions 自动运行**
   - 进入仓库的 **Actions** 标签页
   - 查看工作流运行状态

3. **部署完成后**
   - 生产环境：访问 `https://57blocks-onboarding-site.<your-subdomain>.workers.dev`
   - 预览环境：访问 `https://57blocks-onboarding-site-preview.<your-subdomain>.workers.dev`

### 手动触发部署

1. 进入 GitHub 仓库
2. 点击 **Actions** 标签页
3. 选择 **Deploy** 工作流
4. 点击 **Run workflow**
5. 选择分支并运行

## 🔍 故障排查

### 常见问题

#### 1. 部署失败：认证错误

**错误信息**：
```
Error: Authentication error
```

**解决方案**：
- 检查 `CLOUDFLARE_API_TOKEN` 是否正确
- 确认 Token 权限是否足够
- 检查 Token 是否过期

#### 2. 部署失败：R2 Bucket 不存在

**错误信息**：
```
Bucket not found: 57blocks-onboarding-web3
```

**解决方案**：
- 在 Cloudflare Dashboard 中创建对应的 R2 Bucket
- 确认 `R2_BUCKET` Secret 与 `wrangler.toml` 中的 `bucket_name` 一致

#### 3. 部署失败：上传 MDX 文件失败

**错误信息**：
```
Failed to upload to R2
```

**解决方案**：
- 检查 `R2_ACCESS_KEY_ID` 和 `R2_SECRET_ACCESS_KEY` 是否正确
- 确认 R2 API Token 权限包含 `Object Read & Write`
- 检查 `CLOUDFLARE_ACCOUNT_ID` 是否正确

#### 4. 构建失败：缺少环境变量

**错误信息**：
```
NEXT_PUBLIC_* is not defined
```

**解决方案**：
- 检查是否在 GitHub Secrets 中配置了所有必需的环境变量
- 查看工作流中的 `env` 配置，确认所有变量都已设置

#### 5. Worker 部署失败：Worker 创建失败

**错误信息**：
```
Error: Failed to create worker
```

**可能原因**：
- API Token 权限不足（需要 `Cloudflare Workers:Edit`）
- Worker 名称已被占用
- Account ID 不正确

**解决方案**：
- 检查 API Token 权限是否包含 `Cloudflare Workers:Edit`
- 确认 Worker 名称在账户中是唯一的
- 验证 `CLOUDFLARE_ACCOUNT_ID` Secret 是否正确
- 如果 Worker 名称冲突，修改 `wrangler.toml` 中的 `name`

#### 6. Worker 部署成功但无法访问

**可能原因**：
- `workers_dev = true` 未在 `wrangler.toml` 中设置
- 自定义域名未正确配置
- Worker 名称冲突

**解决方案**：
- 检查 `wrangler.toml` 配置
- 在 Cloudflare Dashboard 中查看 Worker 状态
- 检查 Worker 路由配置

### 查看日志

1. 进入 GitHub Actions 页面
2. 点击失败的运行
3. 展开各个步骤查看详细日志
4. 特别关注：
   - **Upload Compiled MDX to R2** 步骤
   - **Build** 步骤
   - **Deploy** 步骤

## 📊 监控部署状态

### GitHub Actions 状态徽章

你可以在 README 中添加状态徽章：

```markdown
![Deploy Status](https://github.com/<username>/<repo>/workflows/Deploy/badge.svg)
```

### Cloudflare Dashboard

1. 进入 **Workers & Pages**
2. 查看 Worker 状态和日志
3. 检查 R2 Bucket 中的文件

## 🔄 更新配置

### 修改分支名称

如果使用 `main` 而不是 `master`：

```yaml
# .github/workflows/deploy.yaml
deploy:
  if: github.ref == 'refs/heads/main'  # 修改这里
```

### 修改 Worker 名称

1. 更新 `wrangler.toml` 中的 `name`
2. 更新预览环境的 `name`（在 `[env.preview]` 中）

### 修改 R2 Bucket 名称

1. 更新 `wrangler.toml` 中的 `bucket_name`
2. 更新 GitHub Secret `R2_BUCKET`
3. 在 Cloudflare 中创建新的 Bucket（如果使用新名称）

## ✅ 验证部署

部署成功后，验证以下内容：

1. ✅ **Worker 已创建/更新**
   - 进入 Cloudflare Dashboard → **Workers & Pages**
   - 确认 Worker `57blocks-onboarding-site` 存在且状态为 "Active"
   - 如果是首次部署，Worker 应该已经被自动创建
2. ✅ 可以访问 Worker URL
   - 生产环境：`https://57blocks-onboarding-site.<your-subdomain>.workers.dev`
   - 预览环境：`https://57blocks-onboarding-site-preview.<your-subdomain>.workers.dev`
3. ✅ R2 Bucket 中包含编译后的 MDX 文件
   - 进入 R2 → `57blocks-onboarding-web3` bucket
   - 确认 `compiled-mdx/` 前缀下有 JSON 文件
4. ✅ 网站功能正常（课程、挑战等页面可以访问）

## 📚 相关资源

- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Wrangler 文档](https://developers.cloudflare.com/workers/wrangler/)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [OpenNext for Cloudflare 文档](https://opennext.js.org/cloudflare)
