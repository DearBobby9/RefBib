# RefBib 规划与进度（2026-02 更新）

## 当前状态快照

RefBib 已完成 **Phase 1.5（MVP+）**，在原有单篇提取闭环上新增本地 Workspace 可视化与 unmatched 可发现性。

当前代码已实现的核心链路：

1. PDF 上传与校验（扩展名、MIME、魔数、50MB 限制）
2. GROBID 解析（支持多实例自动 fallback）
3. BibTeX 多源瀑布匹配（CrossRef -> Semantic Scholar -> DBLP -> fallback `@misc`）
4. 结果可视化与筛选（matched / fuzzy / unmatched）
5. 勾选后复制/下载 `.bib`
6. Workspace（本地持久化、去重统计、冲突队列、工作区导出）
7. Unmatched 二次发现（CrossRef / S2 / DBLP，`available/unavailable`）
8. 顶部双视图导航（Extract / Workspace）
9. 密码门 + 冷启动提示 + 深色模式

## 产品定位

一句话：**拖入论文 PDF，快速拿到可用的参考文献 BibTeX 列表。**

目标用户：使用 LaTeX / Overleaf 写论文、需要从 related work 中批量收集引用的研究人员与学生。

## 已完成 / 未完成功能矩阵

### P0（MVP）

| 功能 | 状态 | 说明 |
|------|------|------|
| 单 PDF 上传 | ✅ | 前端拖拽/选择上传 |
| 参考文献解析 | ✅ | GROBID 解析 TEI XML |
| BibTeX 匹配 | ✅ | CrossRef + S2 + DBLP 瀑布匹配 |
| 匹配状态展示 | ✅ | Matched / Fuzzy / Unmatched |
| 勾选与导出 | ✅ | 复制与下载 `.bib` |
| 失败回退 | ✅ | fallback `@misc` 自动生成 |
| Unmatched 可发现性检查 | ✅ | 三源探测，独立于 `match_status` |
| 单 Workspace 可视化 | ✅ | 本地持久化 + 去重统计 + 导出 |

### P1（增强）

| 功能 | 状态 | 说明 |
|------|------|------|
| 多 PDF 同时上传 | ⬜ | 尚未开始 |
| 多 Workspace 管理 | ⬜ | 尚未开始（已预留数据结构） |
| 跨 PDF 批量导入 | ⬜ | 尚未开始（当前通过逐篇 Add 到 Workspace） |
| 按年份/来源筛选 | ⬜ | 当前仅支持关键字 + 状态筛选 |
| 未匹配手动修正重试 | ⬜ | 当前提供发现性标注 + Scholar 跳转 |
| Citation key 规则自定义 | ⬜ | 当前为自动生成与冲突后缀 |

### P2（长期）

| 功能 | 状态 | 说明 |
|------|------|------|
| 主题聚类 | ⬜ | 计划中 |
| 跨 PDF 引用频次 | ⬜ | 计划中 |
| Overleaf 集成 | ⬜ | 计划中 |
| 浏览器插件 | ⬜ | 计划中 |
| 引用关系图谱 | ⬜ | 计划中 |

## 技术架构（当前）

```text
PDF Upload
  -> GROBID processReferences (selected instance first, then fallback chain)
  -> TEI XML parse (title/authors/year/doi/venue/raw citation)
  -> BibTeX waterfall:
       DOI -> CrossRef
       Title -> Semantic Scholar
       Title -> DBLP
       Fallback -> @misc from parsed fields
  -> Frontend list (status + filter + select)
  -> Copy / Download .bib
  -> Add selected to Workspace (local dedup + conflict tagging)
  -> Workspace view (stats + group by source paper + export)
  -> Unmatched discovery check (CrossRef / S2 / DBLP metadata probe)
```

工程保障：

- 服务级速率限制（CrossRef / S2 / DBLP）
- 并发信号量控制（避免上游 API 过载）
- GROBID 健康检查与自动切换
- 后端测试覆盖核心解析、匹配、限流与路由逻辑

## 建议执行路线（接下来 6 周）

### Sprint 1（优先级最高）

- 多 PDF 上传（前端 + `/api/extract` 批处理接口）
- 多 Workspace 管理（新建/切换/重命名/删除）
- 工作区导出能力细化（按分组导出、冲突单独导出）

### Sprint 2

- 年份/来源筛选
- 未匹配条目手动修正入口（标题改写后重试匹配）
- Citation key 规则配置（如 `authorYearWord` / `firstAuthorYear`）
- Discovery 结果缓存策略优化（按来源分别 TTL）

### Sprint 3

- 主题聚类（轻量 embedding + 离线聚类）
- 聚类标签展示与折叠浏览
- 基础用户反馈机制（标记误匹配）

## 产品指标（阶段目标）

| 指标 | 目标 |
|------|------|
| PDF 解析成功率 | >95%（标准会议/期刊版式） |
| BibTeX 匹配率 | >85% |
| 单篇处理耗时 | <30 秒 |
| 关键路径步数 | 上传 -> 勾选 -> 导出（3 步） |

## 风险与约束

1. 公共 API 有速率限制，需要引入缓存层（尤其 DOI 命中）。
2. GROBID 对非标准 PDF（匿名稿、行号版）稳定性较低，需要保留 fallback 与重试策略。
3. 多 PDF 阶段会显著增加并发与外部请求量，需要新增任务队列或批次调度。
4. 长期功能（Overleaf、插件、图谱）依赖外部平台 API 与权限策略，交付节奏需保守评估。
