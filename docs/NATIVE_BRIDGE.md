# Мост веб-интерфейса и Android

Это карта интерфейса, прочитанная из `web/app.js` и таблицы методов DEX. Реализация Java-методов ещё не восстановлена.

JS обращается к `window.NativeAndroid`. При его отсутствии используются браузерное сохранение и явно отключённый режим ограничений.

## Найденные сигнатуры в DEX

| Метод | Параметры (DEX) | Результат (DEX) |
| --- | --- | --- |
| `clearEmergencyPause` | `—` | `V` |
| `completeMission` | `Ljava/lang/String;` | `V` |
| `emergencyPause` | `—` | `V` |
| `exportProgress` | `Ljava/lang/String;` | `V` |
| `getState` | `—` | `Ljava/lang/String;` |
| `importProgress` | `—` | `V` |
| `loadState` | `—` | `Ljava/lang/String;` |
| `openAccessibilitySettings` | `—` | `V` |
| `saveState` | `Ljava/lang/String;` | `V` |
| `setFocusEnabled` | `Z` | `V` |
| `setSelectedApps` | `Ljava/lang/String;` | `V` |

## Контракт, используемый JavaScript

`getState()` возвращает JSON-строку. Код UI использует `native`, `accessibilityEnabled`, `selectedApps`, `availableApps`, `focusEnabled`, `missionCompletedToday`, `emergencyUntil`. Точную валидацию и все поля надо сверить с декомпилированной Java.

`loadState()` / `saveState(json)` хранят учебное состояние. Браузерный ключ: `unlock-english-v1`; JSON имеет `version: 1`. Не менять формат без миграции.

`completeMission(day)` вызывается после локально подтверждённого выполнения квиза и письма. AI-оценка не должна напрямую управлять этим методом.

`setFocusEnabled(boolean)`, `setSelectedApps(json)`, `openAccessibilitySettings()`, `emergencyPause()` и `clearEmergencyPause()` используются экраном фокуса.

Экспорт/импорт: `exportProgress(json)`, `importProgress()`; обратный вызов `window.onNativeImport(...)` определён в `app.js`.

`window.onNativeBack()` возвращает, обработан ли переход назад веб-частью. Событие `native-state-changed` заставляет UI перечитать состояние Android.

Манифест регистрирует `MainActivity` и `FocusAccessibilityService`. Конфигурация сервиса содержит `canRetrieveWindowContent=false` и `isAccessibilityTool=false`. Это факт конфигурации, не проверка фактического поведения на телефоне.

## Следующий шаг

Декомпилировать APK, проверить `MainActivity.java`, `AppState.java`, `FocusAccessibilityService.java` и вспомогательные классы, восстановить ресурсы и сборку. Не писать случайную заглушку, которая возвращает успешную блокировку без реального Android-механизма.
