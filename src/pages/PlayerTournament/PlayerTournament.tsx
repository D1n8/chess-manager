import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import type { Tournament, Match } from '../../types'

export default function PlayerTournament() {
    const { id } = useParams<{ id: string }>()
    const [matches, setMatches] = useState<Match[]>([])
    const [tournament, setTournament] = useState<Tournament | null>(null)
    const fetchData = async (tournamentId: string) => {
        const { data: tData } = await supabase.from('tournaments').select('*').eq('id', tournamentId).single()
        const { data: mData } = await supabase.from('matches').select('*').eq('tournament_id', tournamentId)

        if (tData) setTournament(tData as Tournament)
        if (mData) setMatches(mData as Match[])
    }

    useEffect(() => {
        if (id) fetchData(id)
    }, [id])

    if (!tournament) return <div>Загрузка...</div>

    return (
        <div>
            <h1>Турнир: {tournament.title}</h1>
            <h2>Жеребьевка и результаты</h2>
            <table>
                <thead>
                    <tr>
                        <th>Стол</th>
                        <th>Белые</th>
                        <th>Черные</th>
                        <th>Результат</th>
                    </tr>
                </thead>
                <tbody>
                    {matches.map(m => (
                        <tr key={m.id}>
                            <td>{m.table_number}</td>
                            <td>{m.player_white}</td>
                            <td>{m.player_black}</td>
                            <td>{m.result || 'Ожидается'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}