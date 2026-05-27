# 🤝 Contributing to StoxArea

Terima kasih telah tertarik untuk berkontribusi pada StoxArea! Panduan ini akan membantu Anda memulai.

## 📋 Code of Conduct

- Hormati semua kontributor
- Hindari bahasa yang merendahkan atau diskriminatif
- Diskusi yang konstruktif dan ramah

## 🚀 Cara Berkontribusi

### 1. Fork Repository
```bash
git clone https://github.com/your-username/STOXAREA.git
cd STOXAREA
```

### 2. Create Feature Branch
```bash
git checkout -b feature/your-feature-name
# atau untuk bug fixes:
git checkout -b fix/bug-description
```

### 3. Buat Perubahan

#### Backend (Python)
- Follow PEP 8 style guide
- Gunakan `black` untuk formatting:
  ```bash
  pip install black
  black stoxarea-backend/
  ```
- Gunakan type hints untuk semua fungsi
- Tambahkan docstrings dalam Bahasa Indonesia atau English yang jelas

#### Frontend (TypeScript/React)
- Gunakan Prettier untuk formatting:
  ```bash
  npm run format
  ```
- Follow React best practices
- Gunakan TypeScript strict mode
- Buat component yang reusable

### 4. Testing

#### Backend Tests
```bash
cd stoxarea-backend
pip install pytest pytest-cov
pytest tests/ -v --cov=app
```

#### Frontend Tests
```bash
cd stoxarea-frontend
npm test
```

### 5. Commit dengan Format Konvensional

```bash
git commit -m "feat: add new feature description"
# atau
git commit -m "fix: resolve bug description"
# atau
git commit -m "docs: update documentation"
# atau
git commit -m "refactor: improve code quality"
```

**Tipe commit yang umum:**
- `feat`: Fitur baru
- `fix`: Bug fix
- `docs`: Documentation
- `refactor`: Code refactoring
- `perf`: Performance improvement
- `test`: Test addition/modification
- `chore`: Build, dependencies, etc.

### 6. Push dan Create Pull Request

```bash
git push origin feature/your-feature-name
```

Buat Pull Request di GitHub dengan deskripsi yang jelas tentang:
- Apa yang berubah
- Mengapa perlu perubahan ini
- Testing yang sudah dilakukan
- Screenshots (jika ada UI changes)

## 📝 Pull Request Guidelines

### Deskripsi PR harus mencakup:

```markdown
## Description
Jelaskan perubahan yang dilakukan dengan jelas

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issue
Fix #123 (reference issue number jika ada)

## Testing
Jelaskan testing yang sudah dilakukan:
- [ ] Unit tests passed
- [ ] Manual testing completed
- [ ] No breaking changes

## Screenshots (jika ada UI changes)
Attach screenshots atau GIFs

## Checklist
- [ ] Code follows project style guidelines
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests added/updated
- [ ] CHANGELOG updated (jika ada)
```

## 🐛 Reporting Bugs

### Bug Report Format

1. **Judul yang jelas dan deskriptif**
   ```
   ❌ Tidak baik: "Tidak bisa login"
   ✅ Baik: "Login gagal dengan email format khusus (contains +)"
   ```

2. **Reproduksi langkah-langkah**
   ```
   1. Buka halaman login
   2. Masukkan email user+test@example.com
   3. Masukkan password
   4. Klik tombol Login
   5. Error muncul
   ```

3. **Expected behavior**
   - Apa yang seharusnya terjadi

4. **Actual behavior**
   - Apa yang sebenarnya terjadi

5. **Screenshots / Error logs**
   - Console errors
   - Network responses
   - Database logs

6. **Environment**
   ```
   - Browser: Chrome 120
   - OS: Windows 11
   - Backend version: 1.0.0
   - Frontend version: 1.0.0
   ```

## 🎨 Feature Request

### Feature Request Format

1. **Deskripsi feature**
   - Apa yang ingin ditambahkan
   - Use case atau benefit

2. **Implementasi yang diusulkan**
   - Solusi yang Anda bayangkan
   - Alternatif lain

3. **Context tambahan**
   - Mockup / screenshot (jika ada)
   - Referensi dari project lain

## 📚 Development Setup

### Backend Development

```bash
cd stoxarea-backend

# Setup virtual environment
python -m venv venv
source venv/Scripts/activate  # Windows

# Install dependencies
pip install -r requirements.txt
pip install -e .  # Install in development mode

# Setup pre-commit hooks (optional)
pip install pre-commit
pre-commit install

# Run server
uvicorn app.main:app --reload

# Lint & format
black .
flake8 .
```

### Frontend Development

```bash
cd stoxarea-frontend

# Install dependencies
npm install

# Run dev server
npm run dev

# Format & lint
npm run format
npm run lint

# Type check
npm run type-check
```

## 🔍 Code Review Process

1. **Automated checks**
   - Tests harus pass
   - Linter checks harus pass
   - Code coverage harus maintain

2. **Manual review**
   - Minimal 1 maintainer review
   - Feedback akan diberikan
   - Revisi bisa diminta

3. **Approval & Merge**
   - PR dapat di-merge setelah approval
   - Squash commits untuk cleaner history

## 📖 Documentation

Ketika menambah fitur baru, update dokumentasi:

- **README.md** - Tambah fitur ke feature list
- **Code comments** - Jelaskan logic yang kompleks
- **Docstrings** - Semua fungsi public harus punya docstring
- **API docs** - Update OpenAPI/Swagger docs (untuk FastAPI)

### Docstring Format (Python)

```python
def calculate_saw_score(profile_weights: dict, metrics: dict) -> float:
    """
    Hitung SAW score berdasarkan profile weights dan metrics.
    
    Args:
        profile_weights (dict): Bobot untuk setiap metric (ROE, DER, PER, AI)
        metrics (dict): Nilai metrik saham yang akan dihitung
    
    Returns:
        float: SAW score (0-100)
    
    Raises:
        ValueError: Jika profile_weights atau metrics tidak valid
    
    Example:
        >>> weights = {"roe": 0.3, "der": 0.3, "per": 0.2, "ai": 0.2}
        >>> metrics = {"roe": 0.18, "der": 0.5, "per": 15, "ai": 0.65}
        >>> score = calculate_saw_score(weights, metrics)
        >>> score
        72.5
    """
    # implementation
    pass
```

### Docstring Format (TypeScript)

```typescript
/**
 * Hitung SAW score berdasarkan profile weights dan metrics
 * 
 * @param profileWeights - Bobot untuk setiap metric
 * @param metrics - Nilai metrik saham
 * @returns SAW score (0-100)
 * @throws Error jika input tidak valid
 * 
 * @example
 * const weights = { roe: 0.3, der: 0.3, per: 0.2, ai: 0.2 }
 * const metrics = { roe: 18, der: 0.5, per: 15, ai: 65 }
 * const score = calculateSawScore(weights, metrics) // 72.5
 */
export function calculateSawScore(
  profileWeights: ProfileWeights,
  metrics: StockMetrics
): number {
  // implementation
}
```

## 🚀 Release Process

1. Update version di `package.json` (frontend) dan `pyproject.toml` (backend)
2. Update CHANGELOG.md
3. Create release tag: `git tag v1.0.0`
4. Push tag: `git push origin v1.0.0`
5. Create GitHub Release dengan release notes

## ❓ Questions?

- Buka GitHub Discussions
- Email: dev@stoxarea.app
- Check existing issues & documentation

---

**Terima kasih telah berkontribusi! 🎉**
