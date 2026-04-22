"""
Vika（维格表）→ Supabase 数据迁移脚本

使用方法：
  1. pip install requests supabase
  2. 填写下方 VIKA_* 和 SUPABASE_* 配置
  3. python migrate_vika_to_supabase.py

功能：
  - 从 Vika API 分页读取所有测试记录
  - 转换字段格式后批量写入 Supabase test_results 表
  - 所有迁移数据的 session_id 统一标记为 'legacy-vika'
  - 支持断点续传（会跳过已存在的记录）
"""

import json
import time
import requests
from datetime import datetime

# ============================================================
# 配置区（请填写你自己的值）
# ============================================================

# Vika 配置（从旧代码的混淆配置中解码，或直接填明文）
VIKA_TOKEN = 'uskKYWXlhWYMZBGQpGNm5UM'          # 你的 Vika API Token
VIKA_DATASHEET_ID = 'dstsYemg1eXzhgTSRS'   # 你的 Vika 数据表 ID

# Supabase 配置
SUPABASE_URL = 'https://hiuhfieznrvuquxkooao.supabase.co'
SUPABASE_KEY = 'sb_publishable_C2LxRpiSRyeEZrhu7HKkfQ_YvesOoH2'

# ============================================================
# Vika 字段名映射（根据你 Vika 表的实际列名调整）
# ============================================================
VIKA_FIELD_MAP = {
    'personality': '人格类型',      # 或 'personality'，看你 Vika 表的列名
    'model_scores': '五维分数',     # 或 'modelScores'
    'levels': '维度等级',           # 或 'levels'
    'created_at': '提交时间',       # 或 'submitTime' / 'createdAt'
}

# ============================================================
# 主逻辑
# ============================================================

def fetch_vika_records():
    """从 Vika 分页读取所有记录"""
    all_records = []
    page_num = 1
    page_size = 1000

    while True:
        url = f'https://api.vika.cn/fusion/v1/datasheets/{VIKA_DATASHEET_ID}/records'
        params = {
            'pageSize': page_size,
            'pageNum': page_num
        }
        headers = {
            'Authorization': f'Bearer {VIKA_TOKEN}'
        }

        print(f'  正在读取 Vika 第 {page_num} 页...')

        # 重试逻辑：Vika 免费版 QPS 限制每秒 2 次
        max_retries = 5
        for attempt in range(max_retries):
            resp = requests.get(url, params=params, headers=headers)
            data = resp.json()

            if data.get('code') == 200 and data.get('data'):
                break  # 成功
            elif 'API调用频率' in data.get('message', '') or '频率' in data.get('message', ''):
                wait = 2 ** attempt  # 指数退避: 1s, 2s, 4s, 8s, 16s
                print(f'  ⏳ QPS 限流，等待 {wait} 秒后重试 ({attempt+1}/{max_retries})...')
                time.sleep(wait)
            else:
                print(f'  ⚠️ Vika API 返回异常: {data.get("message", "未知错误")}')
                return all_records
        else:
            print(f'  ❌ 重试 {max_retries} 次仍失败，已读取 {len(all_records)} 条')
            return all_records

        records = data['data'].get('records', [])
        all_records.extend(records)

        total = data['data'].get('total', 0)
        print(f'  已读取 {len(all_records)}/{total} 条')

        if len(all_records) >= total:
            break

        page_num += 1
        time.sleep(0.6)  # 每页间隔 0.6 秒，保持在 QPS 限制内

    return all_records


def transform_record(vika_record):
    """将 Vika 记录转换为 Supabase 格式"""
    fields = vika_record.get('fields', {})

    # 尝试多种可能的字段名
    personality = (
        fields.get(VIKA_FIELD_MAP['personality']) or
        fields.get('personality') or
        fields.get('人格类型') or
        ''
    )

    model_scores = (
        fields.get(VIKA_FIELD_MAP['model_scores']) or
        fields.get('modelScores') or
        fields.get('model_scores') or
        fields.get('五维分数') or
        []
    )

    levels = (
        fields.get(VIKA_FIELD_MAP['levels']) or
        fields.get('levels') or
        fields.get('维度等级') or
        []
    )

    created_at = (
        fields.get(VIKA_FIELD_MAP['created_at']) or
        fields.get('submitTime') or
        fields.get('createdAt') or
        fields.get('提交时间') or
        None
    )

    # 确保 model_scores 和 levels 是列表
    if isinstance(model_scores, str):
        try:
            model_scores = json.loads(model_scores)
        except:
            model_scores = []

    if isinstance(levels, str):
        try:
            levels = json.loads(levels)
        except:
            levels = []

    # 处理时间格式
    if isinstance(created_at, (int, float)):
        # Vika 可能返回毫秒时间戳
        created_at = datetime.fromtimestamp(created_at / 1000).isoformat()

    if not personality:
        return None  # 跳过无效记录

    return {
        'session_id': 'legacy-vika',
        'personality': personality,
        'model_scores': model_scores,
        'levels': levels,
        'test_number': 1,
        'referrer': None,
        'utm_source': None,
        'user_agent': None,
        'screen_size': None,
        'env': 'prod',
        'created_at': created_at
    }


def get_existing_count():
    """查询 Supabase 中已有的 legacy-vika 记录数"""
    url = f'{SUPABASE_URL}/rest/v1/test_results'
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Prefer': 'count=exact'
    }
    params = {
        'session_id': 'eq.legacy-vika',
        'select': 'id',
        'limit': 0
    }
    try:
        resp = requests.get(url, headers=headers, params=params)
        # count 在响应头 content-range 中: */N
        content_range = resp.headers.get('content-range', '')
        if '/' in content_range:
            return int(content_range.split('/')[-1])
    except:
        pass
    return 0


def insert_to_supabase(records):
    """批量写入 Supabase"""
    url = f'{SUPABASE_URL}/rest/v1/test_results'
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
    }

    # 分批插入，每批 50 条
    batch_size = 50
    total = len(records)

    for i in range(0, total, batch_size):
        batch = records[i:i + batch_size]
        resp = requests.post(url, json=batch, headers=headers)

        if resp.status_code in (200, 201):
            print(f'  ✅ 已插入 {min(i + batch_size, total)}/{total} 条')
        else:
            print(f'  ❌ 插入失败 (HTTP {resp.status_code}): {resp.text}')
            print(f'     失败的批次: 第 {i+1}~{min(i+batch_size, total)} 条')


def main():
    print('=' * 50)
    print('Vika → Supabase 增量迁移工具')
    print('=' * 50)

    if not VIKA_TOKEN or not VIKA_DATASHEET_ID:
        print('\n⚠️ 请先在脚本中填写 VIKA_TOKEN 和 VIKA_DATASHEET_ID')
        return

    # 0. 查询已迁移数量
    existing = get_existing_count()
    print(f'\n📊 Supabase 中已有 {existing} 条 legacy-vika 记录')

    # 1. 从 Vika 读取
    print('\n📖 步骤 1/3：从 Vika 读取数据...')
    vika_records = fetch_vika_records()

    if not vika_records:
        print('  未读取到任何记录，迁移结束')
        return

    # 2. 转换格式
    print(f'\n🔄 步骤 2/3：转换数据格式...')
    supabase_records = []
    skipped = 0

    for r in vika_records:
        transformed = transform_record(r)
        if transformed:
            supabase_records.append(transformed)
        else:
            skipped += 1

    print(f'  Vika 有效记录: {len(supabase_records)} 条')
    if skipped:
        print(f'  跳过无效: {skipped} 条')

    if not supabase_records:
        print('  没有可迁移的数据')
        return

    # 3. 增量判断
    new_count = len(supabase_records) - existing
    if new_count <= 0:
        print(f'\n✅ 数据已是最新，无需迁移（Vika {len(supabase_records)} 条 = Supabase {existing} 条）')
        return

    # 只取新增的记录（Vika 按时间顺序返回，新记录在后面）
    new_records = supabase_records[existing:]
    print(f'  需要增量迁移: {len(new_records)} 条新记录')

    # 4. 写入 Supabase
    print(f'\n📝 步骤 3/3：写入 Supabase...')
    insert_to_supabase(new_records)

    print(f'\n✅ 增量迁移完成！')
    print(f'  本次新增 {len(new_records)} 条（总计 {existing + len(new_records)} 条）')
    print(f'  所有迁移数据的 session_id = "legacy-vika"')
    print(f'\n  验证: 在 Supabase SQL Editor 执行:')
    print(f'  SELECT COUNT(*) FROM test_results WHERE session_id = \'legacy-vika\';')


if __name__ == '__main__':
    main()
