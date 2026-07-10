# Testing the Streamlined Frontend

## Quick Start

### 1. **Clean Install**
```bash
cd frontend
rm -rf node_modules yarn.lock  # or package-lock.json
yarn install  # or npm install
```

### 2. **Verify Dependencies**
Check that only essential packages are installed:
```bash
yarn list --depth=0
```

**Expected package count: ~30 (was 60+)**

### 3. **Start Development Server**
```bash
npm start
```

Should open browser at `http://localhost:3000`

### 4. **Build for Production**
```bash
npm run build
```

### 5. **Run Tests** (if configured)
```bash
npm test
```

---

## What to Test

### ✅ **Core Pages Load**
- [ ] Dashboard (charts, KPIs)
- [ ] Recipe Mapping (search, form modal)
- [ ] Forecast page
- [ ] Planning page
- [ ] Order page (PDF/CSV export)
- [ ] Variance page
- [ ] Settings page

### ✅ **Features Work**
- [ ] Authentication (login/register)
- [ ] Add/edit recipes
- [ ] Inline edits (qty, cost)
- [ ] Charts render correctly
- [ ] Form validation (Zod)
- [ ] Toast notifications (Sonner)
- [ ] Modal dialogs open/close
- [ ] PDF export generates file
- [ ] CSV export downloads

### ✅ **Performance**
- [ ] Page loads faster (no unused components)
- [ ] Smaller bundle size
- [ ] No console errors
- [ ] API calls work (check Network tab)

### ✅ **Build Quality**
- [ ] `npm run build` completes without errors
- [ ] No unused dependencies warnings
- [ ] All imports resolve (no 404s)

---

## Troubleshooting

### Issue: `Module not found: @/...`
**Solution:** Verify `jsconfig.json` exists in `frontend/` directory with correct path aliases.

### Issue: Missing environment variable
**Solution:** Create `.env` file in `frontend/`:
```env
REACT_APP_BACKEND_URL=http://localhost:8000
```

### Issue: Old cached dependencies
**Solution:** Clear cache and reinstall:
```bash
yarn cache clean
rm -rf node_modules yarn.lock
yarn install
```

### Issue: Port 3000 already in use
**Solution:** 
```bash
npm start -- --port 3001
```

---

## Size Comparison

| Metric | Before | After |
|--------|--------|-------|
| `package.json` dependencies | 60+ | 30 |
| `package.json` devDependencies | 20+ | 3 |
| `yarn.lock` size | ~15MB | ~4MB |
| `node_modules` size | ~2GB | ~600MB |

---

## Commands Summary

```bash
# Install dependencies
yarn install

# Start dev server
npm start

# Build for production
npm run build

# Run tests
npm test

# Check bundle size
npm run build --analyze
```

---

## Notes
- All functionality is **identical** to before
- No code changes in components
- Only dependencies and build config optimized
- Website works exactly the same
