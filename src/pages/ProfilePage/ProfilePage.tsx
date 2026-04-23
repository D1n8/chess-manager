import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import type { AppUser, Tournament } from '../../types'
import './ProfilePage.css'

// Вспомогательный интерфейс для истории (Связка турнира и статуса заявки)
interface HistoryItem {
    status: string;
    tournament: Tournament;
}

export default function ProfilePage({ onLogout }: { onLogout: () => void }) {
    const [history, setHistory] = useState<HistoryItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const user: AppUser = JSON.parse(localStorage.getItem('user')!)

    const fetchHistory = async () => {
        // Получаем статус заявки и нужные поля турнира (обрати внимание на start_datetime)
        const { data, error } = await supabase
            .from('participants')
            .select('status, tournaments(id, title, city, start_datetime, time_control)')
            .eq('player_id', user.id)

        if (error) {
            console.error('Ошибка загрузки истории:', error)
            return
        }

        if (data) {
            const parsedHistory = data
                .filter(item => item.tournaments !== null) // Отсекаем пустые
                .map((item: any) => ({
                    status: item.status,
                    tournament: item.tournaments
                }))

            // Сортируем: сначала новые (по дате начала)
            parsedHistory.sort((a, b) =>
                new Date(b.tournament.start_datetime).getTime() - new Date(a.tournament.start_datetime).getTime()
            )

            setHistory(parsedHistory)
        }

        setIsLoading(false)
    }

    useEffect(() => {
        if (user.role === 'player') fetchHistory()
        else setIsLoading(false)
    }, [])

    const handleLogout = () => {
        localStorage.removeItem('user')
        onLogout()
    }

    // Красивое форматирование даты
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('ru-RU', {
            day: 'numeric', month: 'long', year: 'numeric'
        })
    }

    if (isLoading) {
        return <div className="container"><div className="loader-container"><div className="spinner"></div></div></div>
    }

    return (
        <div className="container">
            <div className="profile-card">
                <h2>Личный кабинет</h2>
                <p><strong>Email:</strong> {user.email}</p>
                <p><strong>Роль:</strong> {user.role === 'organizer' ? 'Организатор' : 'Игрок'}</p>
                <p><strong>ФИО:</strong> {user.full_name}</p>

                {user.role === 'player' && (
                    <>
                        <p><strong>Возраст:</strong> {user.age} лет</p>
                        <p><strong>Рейтинг ФИДЕ/ФШР:</strong> {user.rating}</p>
                    </>
                )}

                <button className="btn-primary" style={{ marginTop: '20px' }} onClick={handleLogout}>
                    Выйти из аккаунта
                </button>
            </div>

            {user.role === 'player' && (
                <div>
                    <h2 style={{ color: '#660000', marginBottom: '15px' }}>История турниров</h2>

                    {history.length === 0 ? (
                        <p>Вы еще не подавали заявки на турниры.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {history.map((h, index) => (
                                <div key={index} className="history-item" style={{
                                    backgroundColor: '#fff',
                                    padding: '15px',
                                    borderRadius: '6px',
                                    borderLeft: `5px solid ${h.status === 'confirmed' ? '#2e8b57' : '#ffa500'}`,
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <strong style={{ fontSize: '18px' }}>{h.tournament.title}</strong>
                                        <span style={{
                                            padding: '4px 8px',
                                            borderRadius: '12px',
                                            fontSize: '12px',
                                            color: '#fff',
                                            backgroundColor: h.status === 'confirmed' ? '#2e8b57' : '#ffa500'
                                        }}>
                                            {h.status === 'confirmed' ? 'Участвовал(а)' : 'На рассмотрении'}
                                        </span>
                                    </div>
                                    <div style={{ color: '#555', fontSize: '14px' }}>
                                        г. {h.tournament.city} • Формат: {h.tournament.time_control} • {formatDate(h.tournament.start_datetime)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}