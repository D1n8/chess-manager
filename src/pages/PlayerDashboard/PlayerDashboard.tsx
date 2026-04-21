import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import type { Tournament, AppUser } from '../../types'
import './PlayerDashboard.css'

export default function PlayerDashboard() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])

  // Состояния фильтров
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCity, setFilterCity] = useState('')
  const [filterFormat, setFilterFormat] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('') // Начало диапазона
  const [filterDateTo, setFilterDateTo] = useState('')     // Конец диапазона

  const navigate = useNavigate()

  const fetchTournaments = async () => {
    const userString = localStorage.getItem('user')
    if (!userString) return
    const user: AppUser = JSON.parse(userString)

    // 1. Получаем все турниры
    const { data: tData } = await supabase.from('tournaments').select('*')

    // 2. Получаем всех ПОДТВЕРЖДЕННЫХ участников для подсчета свободных мест
    const { data: pData } = await supabase.from('participants').select('tournament_id').eq('status', 'confirmed')

    // 3. Получаем ВСЕ заявки ТЕКУЩЕГО ИГРОКА (и pending, и confirmed), чтобы заблокировать кнопку
    const { data: myApps } = await supabase.from('participants').select('tournament_id').eq('player_id', user.id)

    if (tData) {
      // Считаем занятые места
      const counts: Record<string, number> = {}
      if (pData) {
        pData.forEach(p => {
          counts[p.tournament_id] = (counts[p.tournament_id] || 0) + 1
        })
      }

      // Создаем Set (список) из ID турниров, куда мы уже подали заявку
      const appliedSet = new Set(myApps?.map(a => a.tournament_id) || [])

      // Обогащаем турниры новыми полями
      const enrichedTournaments = tData.map(t => ({
        ...t,
        confirmed_count: counts[t.id] || 0,
        has_applied: appliedSet.has(t.id) // true, если игрок уже подал заявку
      }))

      setTournaments(enrichedTournaments)
    }
  }

  useEffect(() => {
    fetchTournaments()
  }, [])

  const handleApply = async (tId: string) => {
    const userString = localStorage.getItem('user')
    if (!userString) return
    const user: AppUser = JSON.parse(userString)

    const { error } = await supabase.from('participants').insert([{ tournament_id: tId, player_id: user.id }])

    if (error) {
      alert('Ошибка при подаче заявки!')
    } else {
      alert('Заявка успешно отправлена организатору!')
      fetchTournaments() // Сразу обновляем список, чтобы кнопка заблокировалась
    }
  }

  // --- ЛОГИКА ФИЛЬТРАЦИИ ---
  const filteredTournaments = tournaments.filter(t => {
    const matchSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchCity = filterCity === '' || t.city === filterCity
    const matchFormat = filterFormat === '' || t.time_control === filterFormat

    // Фильтр диапазона дат начала турнира
    const tDate = new Date(t.start_datetime)
    const matchDateFrom = filterDateFrom === '' || tDate >= new Date(filterDateFrom)
    const matchDateTo = filterDateTo === '' || tDate <= new Date(filterDateTo + 'T23:59:59')

    return matchSearch && matchCity && matchFormat && matchDateFrom && matchDateTo
  })

  // Уникальные города для селекта
  const uniqueCities = Array.from(new Set(tournaments.map(t => t.city)))

  // Форматирование даты
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU', {
      dateStyle: 'short',
      timeStyle: 'short'
    })
  }

  return (
    <div className="container">
      <h2 style={{ color: '#660000' }}>Поиск турниров</h2>

      {/* ПАНЕЛЬ ФИЛЬТРОВ */}
      <div className="filters-container">
        <input
          type="text"
          placeholder="Поиск по названию..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: '2' }}
        />

        <select value={filterCity} onChange={(e) => setFilterCity(e.target.value)}>
          <option value="">Все города</option>
          {uniqueCities.map(city => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>

        <select value={filterFormat} onChange={(e) => setFilterFormat(e.target.value)}>
          <option value="">Любой формат</option>
          <option value="блиц">Блиц</option>
          <option value="рапид">Рапид</option>
          <option value="классика">Классика</option>
        </select>

        {/* Блок фильтрации по диапазону дат */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', width: '100%' }}>
          <span style={{ fontWeight: 'bold', color: '#660000', fontSize: '14px' }}>Даты начала турнира:</span>
          <input
            type="date"
            title="Начало диапазона"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            style={{ flex: 1, minWidth: '130px' }}
          />
          <span style={{ color: '#660000' }}>—</span>
          <input
            type="date"
            title="Конец диапазона"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            style={{ flex: 1, minWidth: '130px' }}
          />
        </div>
      </div>

      {/* КАРТОЧКИ ТУРНИРОВ */}
      {filteredTournaments.length === 0 ? (
        <p>По вашему запросу ничего не найдено.</p>
      ) : (
        <div className="grid">
          {filteredTournaments.map(t => {
            const availableSpots = t.total_spots - (t.confirmed_count || 0)

            // Логика блокировки и текста кнопки
            const isButtonDisabled = t.has_applied || availableSpots <= 0
            let buttonText = 'Подать заявку'
            if (t.has_applied) buttonText = 'Заявка подана'
            else if (availableSpots <= 0) buttonText = 'Мест нет'

            return (
              <div key={t.id} className="card">
                <h3>{t.title}</h3>
                <p><strong>Город:</strong> {t.city}</p>
                <p><strong>Формат:</strong> {t.time_control}</p>
                <p><strong>Начало:</strong> {formatDate(t.start_datetime)}</p>
                <p><strong>Окончание:</strong> {formatDate(t.end_datetime)}</p>

                <p>
                  <strong>Свободных мест:</strong>{' '}
                  <span style={{ color: availableSpots > 0 ? '#2e8b57' : '#cc0000', fontWeight: 'bold' }}>
                    {availableSpots > 0 ? `${availableSpots} из ${t.total_spots}` : 'Мест нет'}
                  </span>
                </p>

                <div className="card-actions">
                  <button
                    className="btn-primary"
                    onClick={() => handleApply(t.id)}
                    disabled={isButtonDisabled}
                    style={{
                      opacity: isButtonDisabled ? 0.5 : 1,
                      cursor: isButtonDisabled ? 'not-allowed' : 'pointer',
                      backgroundColor: t.has_applied ? '#2e8b57' : '#660000' // Если подана, красим в зеленый
                    }}
                  >
                    {buttonText}
                  </button>
                  <button
                    className="btn-primary"
                    style={{ backgroundColor: '#000' }}
                    onClick={() => navigate(`/tournaments/${t.id}`)}
                  >
                    Подробнее
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}