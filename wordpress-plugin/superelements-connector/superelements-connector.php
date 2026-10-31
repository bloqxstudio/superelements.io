<?php
/**
 * Plugin Name: Superelements Connector
 * Description: Deixa a plataforma Superelements gravar o SEO do Yoast em páginas e publicar o cabeçalho, o rodapé e os componentes do site como modelos do Elementor, pela API do WordPress.
 * Version: 0.5.0
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Author: Superelements
 * License: GPLv2 or later
 *
 * O Yoast só expõe os campos de SEO na API para posts. Aqui eles ficam
 * expostos também nas páginas e nos outros tipos públicos, com a mesma regra
 * do Yoast: só grava quem pode editar o conteúdo.
 *
 * Os componentes do site (cabeçalho, rodapé e seções que se repetem) viram
 * modelos da Biblioteca do Elementor. O cabeçalho e o rodapé são modelos do
 * Theme Builder do Elementor Pro, com a condição de exibição (site inteiro,
 * menos as páginas que ficam sem): a condição é gravada pelo próprio Theme
 * Builder, que refaz o cache dele. A API do WordPress não expõe nada disso.
 *
 * 0.4: o botão "Entrar no WordPress" da plataforma pede um link de entrada de uso
 * único (60 segundos) para quem já está autenticado pela senha de aplicação, e o
 * site guarda de onde cada visita veio (UTM, gclid, fbclid) para preencher os
 * campos ocultos do formulário que manda o lead ao CRM.
 *
 * 0.5: uma configuração só (`superelements_config`), gravada pela plataforma ao conectar o
 * site (POST superelements/v1/config): a chave e o endereço do painel Site, e o webhook de leads
 * da conta. O script de visitas (assets/visitas.js) vai dentro do plugin e passa a rodar sozinho
 * assim que a chave chega; ninguém cola código no Elementor.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const SUPERELEMENTS_CONNECTOR_VERSION = '0.5.0';

add_action(
	'init',
	function () {
		if ( ! defined( 'WPSEO_VERSION' ) ) {
			return;
		}
		foreach ( get_post_types( array( 'public' => true ) ) as $post_type ) {
			// Nos posts o próprio Yoast já registra; anexos não têm SEO de página.
			if ( in_array( $post_type, array( 'post', 'attachment' ), true ) ) {
				continue;
			}
			foreach ( array( 'title', 'metadesc', 'focuskw' ) as $key ) {
				register_post_meta(
					$post_type,
					'_yoast_wpseo_' . $key,
					array(
						'show_in_rest'  => true,
						'single'        => true,
						'type'          => 'string',
						'auth_callback' => function ( $allowed, $meta_key, $post_id ) {
							return current_user_can( 'edit_post', $post_id );
						},
					)
				);
			}
		}
	},
	20
);

/**
 * Tipo de documento do Elementor de cada componente do Space: o cabeçalho e o
 * rodapé são do Theme Builder; a seção é um container salvo na Biblioteca.
 */
function superelements_part_type( $kind ) {
	$types = array(
		'header'  => 'header',
		'footer'  => 'footer',
		'section' => 'container',
		'widget'  => 'widget',
	);
	return isset( $types[ $kind ] ) ? $types[ $kind ] : null;
}

/** O Theme Builder do Elementor Pro (ou do PRO Elements), se o site tiver. */
function superelements_theme_builder() {
	if ( ! class_exists( '\ElementorPro\Modules\ThemeBuilder\Module' ) ) {
		return null;
	}
	return \ElementorPro\Modules\ThemeBuilder\Module::instance();
}

function superelements_error( $code, $message, $status ) {
	return new WP_Error( $code, $message, array( 'status' => $status ) );
}

/** O modelo como a plataforma lê: tipo, condições, data da última mudança e, ao pedir, o JSON do Elementor. */
function superelements_part_response( $post_id, $with_data = false ) {
	$post       = get_post( $post_id );
	$conditions = get_post_meta( $post_id, '_elementor_conditions', true );
	$document   = \Elementor\Plugin::$instance->documents->get( $post_id, false );
	$response   = array(
		'id'           => (int) $post_id,
		'title'        => $post ? $post->post_title : '',
		'type'         => get_post_meta( $post_id, '_elementor_template_type', true ),
		'status'       => $post ? $post->post_status : '',
		'modified_gmt' => $post ? $post->post_modified_gmt : '',
		'conditions'   => is_array( $conditions ) ? array_values( $conditions ) : array(),
		'edit_url'     => $document ? $document->get_edit_url() : admin_url( 'post.php?post=' . $post_id . '&action=elementor' ),
	);
	if ( $with_data ) {
		$response['elementor_data'] = (string) get_post_meta( $post_id, '_elementor_data', true );
	}
	return $response;
}

/** O modelo pedido, se ele existe, é da Biblioteca do Elementor e quem pede pode editar. */
function superelements_existing_part( $post_id ) {
	$post = get_post( $post_id );
	if ( ! $post || 'elementor_library' !== $post->post_type || 'trash' === $post->post_status ) {
		return superelements_error( 'superelements_part_gone', 'O modelo não existe mais no site (foi apagado ou está na lixeira).', 404 );
	}
	if ( ! current_user_can( 'edit_post', $post_id ) ) {
		return superelements_error( 'superelements_forbidden', 'Este usuário não pode editar esse modelo.', 403 );
	}
	return $post;
}

/** "include/general", "exclude/singular/page/12": cada uma vira a lista que o Theme Builder grava. */
function superelements_parse_conditions( $conditions ) {
	$parsed = array();
	foreach ( (array) $conditions as $condition ) {
		$condition = (string) $condition;
		if ( ! preg_match( '#^(include|exclude)(/[a-z0-9_\-]+){1,3}$#', $condition ) ) {
			return superelements_error( 'superelements_bad_condition', 'Condição inválida: ' . $condition, 400 );
		}
		$parsed[] = explode( '/', $condition );
	}
	return $parsed;
}

/** Cria (sem id) ou atualiza o modelo de um componente: o conteúdo, o nome e, no Theme Builder, a condição. */
function superelements_save_part( WP_REST_Request $request ) {
	if ( ! did_action( 'elementor/loaded' ) ) {
		return superelements_error( 'superelements_no_elementor', 'O Elementor não está ativo no site.', 400 );
	}
	$kind = (string) $request['kind'];
	$type = superelements_part_type( $kind );
	if ( ! $type ) {
		return superelements_error( 'superelements_bad_kind', 'Tipo de componente desconhecido: ' . $kind, 400 );
	}
	$theme   = in_array( $kind, array( 'header', 'footer' ), true );
	$builder = superelements_theme_builder();
	if ( $theme && ! $builder ) {
		return superelements_error( 'superelements_no_theme_builder', 'O site não tem o Theme Builder do Elementor Pro.', 400 );
	}
	if ( 'widget' === $kind && ! class_exists( '\ElementorPro\Modules\GlobalWidget\Module' ) ) {
		return superelements_error( 'superelements_no_global_widget', 'O site não tem o Global Widget do Elementor Pro.', 400 );
	}

	$elements = null;
	if ( null !== $request['elements'] ) {
		$elements = json_decode( (string) $request['elements'], true );
		if ( ! is_array( $elements ) ) {
			return superelements_error( 'superelements_bad_elements', 'O conteúdo não é um JSON do Elementor.', 400 );
		}
	}
	$conditions = null;
	if ( $theme && null !== $request['conditions'] ) {
		$conditions = superelements_parse_conditions( $request['conditions'] );
		if ( is_wp_error( $conditions ) ) {
			return $conditions;
		}
	}
	$title     = sanitize_text_field( (string) $request['title'] );
	$documents = \Elementor\Plugin::$instance->documents;
	$post_id   = absint( $request['id'] );

	if ( $post_id ) {
		$post = superelements_existing_part( $post_id );
		if ( is_wp_error( $post ) ) {
			return $post;
		}
		if ( get_post_meta( $post_id, '_elementor_template_type', true ) !== $type ) {
			return superelements_error( 'superelements_wrong_type', 'Esse modelo não é um ' . $type . ' do Elementor.', 409 );
		}
		if ( $title && $title !== $post->post_title ) {
			wp_update_post(
				array(
					'ID'         => $post_id,
					'post_title' => $title,
				)
			);
		}
		$document = $documents->get( $post_id, false );
	} else {
		if ( ! current_user_can( 'publish_posts' ) ) {
			return superelements_error( 'superelements_forbidden', 'Este usuário não pode criar modelos publicados no Elementor.', 403 );
		}
		if ( null === $elements ) {
			return superelements_error( 'superelements_bad_elements', 'Falta o conteúdo do modelo.', 400 );
		}
		$document = $documents->create(
			$type,
			array(
				'post_title'  => $title ? $title : 'Superelements',
				'post_status' => 'publish',
			)
		);
		if ( is_wp_error( $document ) ) {
			return $document;
		}
		$post_id = $document->get_main_id();
	}
	if ( ! $document ) {
		return superelements_error( 'superelements_no_document', 'O Elementor não abriu esse modelo.', 500 );
	}

	if ( null !== $elements && false === $document->save( array( 'elements' => $elements ) ) ) {
		return superelements_error( 'superelements_not_saved', 'O Elementor não gravou o modelo com este usuário.', 403 );
	}
	// Global Widget: o editor do Elementor acha o widget pelo tipo guardado neste campo (como faz ao salvar um pelo editor)
	if ( 'widget' === $kind && null !== $elements && ! empty( $elements[0]['widgetType'] ) ) {
		update_post_meta( $post_id, '_elementor_template_widget_type', sanitize_key( $elements[0]['widgetType'] ) );
	}

	if ( $theme ) {
		$manager = $builder->get_conditions_manager();
		// Outros modelos do mesmo lugar que saem do site (ficam salvos, sem condição)
		foreach ( (array) $request['release'] as $other_id ) {
			$other_id = absint( $other_id );
			if ( ! $other_id || $other_id === $post_id || is_wp_error( superelements_existing_part( $other_id ) ) ) {
				continue;
			}
			if ( get_post_meta( $other_id, '_elementor_template_type', true ) === $type ) {
				$manager->save_conditions( $other_id, array() );
			}
		}
		if ( null !== $conditions ) {
			$manager->save_conditions( $post_id, $conditions );
		}
	}

	// A data de mudança anda a cada gravação daqui: é ela que diz se alguém mexeu no modelo pelo Elementor depois
	wp_update_post( array( 'ID' => $post_id ) );
	clean_post_cache( $post_id );

	return superelements_part_response( $post_id, false );
}

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'superelements/v1',
			'/status',
			array(
				'methods'             => 'GET',
				'permission_callback' => function () {
					return current_user_can( 'edit_pages' );
				},
				'callback'            => function () {
					return array(
						'version'       => SUPERELEMENTS_CONNECTOR_VERSION,
						'yoast'         => defined( 'WPSEO_VERSION' ) ? WPSEO_VERSION : null,
						'elementor'     => defined( 'ELEMENTOR_VERSION' ) ? ELEMENTOR_VERSION : null,
						'elementor_pro' => defined( 'ELEMENTOR_PRO_VERSION' ) ? ELEMENTOR_PRO_VERSION : null,
						'theme_builder' => (bool) superelements_theme_builder(),
					);
				},
			)
		);

		$can_edit = function () {
			return current_user_can( 'edit_posts' );
		};

		// Modelos de um tipo (cabeçalho, rodapé, seção) que o site já tem, com as condições de cada um
		register_rest_route(
			'superelements/v1',
			'/parts',
			array(
				array(
					'methods'             => 'GET',
					'permission_callback' => $can_edit,
					'callback'            => function ( WP_REST_Request $request ) {
						$type = superelements_part_type( (string) $request['kind'] );
						if ( ! $type ) {
							return superelements_error( 'superelements_bad_kind', 'Tipo de componente desconhecido.', 400 );
						}
						$ids = get_posts(
							array(
								'post_type'      => 'elementor_library',
								'post_status'    => array( 'publish', 'draft', 'private' ),
								'posts_per_page' => 100,
								'fields'         => 'ids',
								'meta_key'       => '_elementor_template_type',
								'meta_value'     => $type,
								'orderby'        => 'modified',
							)
						);
						return array_map( 'superelements_part_response', $ids );
					},
				),
				array(
					'methods'             => 'POST',
					'permission_callback' => $can_edit,
					'callback'            => 'superelements_save_part',
				),
			)
		);

		register_rest_route(
			'superelements/v1',
			'/parts/(?P<id>\d+)',
			array(
				array(
					'methods'             => 'GET',
					'permission_callback' => $can_edit,
					'callback'            => function ( WP_REST_Request $request ) {
						$post = superelements_existing_part( absint( $request['id'] ) );
						return is_wp_error( $post ) ? $post : superelements_part_response( $post->ID, true );
					},
				),
				array(
					'methods'             => 'POST',
					'permission_callback' => $can_edit,
					'callback'            => 'superelements_save_part',
				),
			)
		);
	}
);


/**
 * Entrar no painel sem digitar a senha: a plataforma, já autenticada pela senha de
 * aplicação, pede um link; ele vale uma vez, por 60 segundos, e só abre o painel
 * para o mesmo usuário que pediu.
 */
add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'superelements/v1',
			'/login',
			array(
				'methods'             => 'POST',
				'permission_callback' => function () {
					return is_user_logged_in() && current_user_can( 'edit_posts' );
				},
				'callback'            => function ( WP_REST_Request $request ) {
					$to = superelements_admin_path( (string) $request->get_param( 'redirect' ) );
					$token = wp_generate_password( 40, false, false );
					set_transient(
						'superelements_login_' . hash( 'sha256', $token ),
						array(
							'user' => get_current_user_id(),
							'to'   => $to,
						),
						60
					);
					return array( 'url' => add_query_arg( 'superelements_login', $token, home_url( '/' ) ) );
				},
			)
		);
	}
);

/** Só caminhos dentro do wp-admin: nada de endereço de fora nem subir de pasta. */
function superelements_admin_path( $path ) {
	$path = ltrim( (string) $path, '/' );
	if ( '' === $path || ! preg_match( '/^[A-Za-z0-9_\-.\/?=&%#]+$/', $path ) || false !== strpos( $path, '..' ) ) {
		return '';
	}
	return $path;
}

add_action(
	'init',
	function () {
		if ( empty( $_GET['superelements_login'] ) || ! is_string( $_GET['superelements_login'] ) ) {
			return;
		}
		nocache_headers();
		header( 'Referrer-Policy: no-referrer' );
		$key  = 'superelements_login_' . hash( 'sha256', wp_unslash( $_GET['superelements_login'] ) );
		$data = get_transient( $key );
		// Uso único: apaga antes de qualquer coisa
		delete_transient( $key );
		$user = is_array( $data ) ? get_user_by( 'id', (int) $data['user'] ) : false;
		if ( ! $user ) {
			wp_safe_redirect( wp_login_url() );
			exit;
		}
		wp_set_current_user( $user->ID );
		wp_set_auth_cookie( $user->ID, false, is_ssl() );
		do_action( 'wp_login', $user->user_login, $user );
		wp_safe_redirect( admin_url( $data['to'] ) );
		exit;
	},
	1
);

/**
 * De onde cada visita veio: guarda UTM, ids de clique e a origem no navegador e preenche os campos
 * ocultos de mesmo nome dos formulários do Elementor ao enviar. Sem cookie: fica no localStorage, por 30 dias.
 */
add_action(
	'wp_footer',
	function () {
		if ( is_admin() || is_customize_preview() ) {
			return;
		}
		?>
<script>
(function(){try{
var K='superelements_origem',KEYS=['utm_source','utm_medium','utm_campaign','utm_content','utm_term','utm_id','gclid','gbraid','wbraid','fbclid','campaign_id','adset_id','ad_id','placement'];
var s={};try{s=JSON.parse(localStorage.getItem(K)||'{}')}catch(e){}
if(s.at&&Date.now()-s.at>2592e6)s={};
var q=new URLSearchParams(location.search),n={},got=false;
KEYS.forEach(function(k){var v=q.get(k);if(v){n[k]=v;got=true}});
if(got||!s.at){if(got)s=n;s.referrer=document.referrer||'';s.at=Date.now();try{localStorage.setItem(K,JSON.stringify(s))}catch(e){}}
function fill(){document.querySelectorAll('form input').forEach(function(i){var m=/^form_fields\[(.+)\]$/.exec(i.name||'');var k=m?m[1]:i.name;if(k&&s[k]!==undefined&&s[k]!==''&&!i.value)i.value=s[k]})}
fill();document.addEventListener('DOMContentLoaded',fill);document.addEventListener('submit',fill,true);
}catch(e){}})();
</script>
		<?php
	},
	99
);


/**
 * Configuração unificada. Uma opção, escrita pela plataforma (administrador, senha de aplicação):
 * { tracker: { key, endpoint }, leads: { url } }. `tracker: null` desliga o painel Site.
 */
function superelements_config() {
	$config = get_option( 'superelements_config', array() );
	return is_array( $config ) ? $config : array();
}

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'superelements/v1',
			'/config',
			array(
				array(
					'methods'             => 'GET',
					'permission_callback' => function () {
						return current_user_can( 'edit_pages' );
					},
					'callback'            => function () {
						$config = superelements_config();
						return array(
							'version' => SUPERELEMENTS_CONNECTOR_VERSION,
							'tracker' => isset( $config['tracker'] ) ? $config['tracker'] : null,
							'leads'   => isset( $config['leads'] ) ? $config['leads'] : null,
							'script'  => file_exists( plugin_dir_path( __FILE__ ) . 'assets/visitas.js' ),
						);
					},
				),
				array(
					'methods'             => 'POST',
					'permission_callback' => function () {
						return current_user_can( 'manage_options' );
					},
					'callback'            => function ( WP_REST_Request $request ) {
						$config = superelements_config();
						$body   = $request->get_json_params();
						if ( ! is_array( $body ) ) {
							return superelements_error( 'superelements_bad_config', 'Configuração inválida.', 400 );
						}
						if ( array_key_exists( 'tracker', $body ) ) {
							$tracker = $body['tracker'];
							if ( null === $tracker ) {
								unset( $config['tracker'] );
							} else {
								$key      = isset( $tracker['key'] ) ? (string) $tracker['key'] : '';
								$endpoint = isset( $tracker['endpoint'] ) ? esc_url_raw( (string) $tracker['endpoint'], array( 'https' ) ) : '';
								if ( ! preg_match( '/^[0-9a-f-]{36}$/i', $key ) || '' === $endpoint ) {
									return superelements_error( 'superelements_bad_tracker', 'Chave ou endereço do painel Site inválidos.', 400 );
								}
								$config['tracker'] = array( 'key' => strtolower( $key ), 'endpoint' => $endpoint );
							}
						}
						if ( array_key_exists( 'leads', $body ) ) {
							$leads = $body['leads'];
							if ( null === $leads ) {
								unset( $config['leads'] );
							} else {
								$url = isset( $leads['url'] ) ? esc_url_raw( (string) $leads['url'], array( 'https' ) ) : '';
								if ( '' === $url ) {
									return superelements_error( 'superelements_bad_leads', 'Endereço do webhook de leads inválido.', 400 );
								}
								$config['leads'] = array( 'url' => $url );
							}
						}
						update_option( 'superelements_config', $config, false );
						return array(
							'version' => SUPERELEMENTS_CONNECTOR_VERSION,
							'tracker' => isset( $config['tracker'] ) ? $config['tracker'] : null,
							'leads'   => isset( $config['leads'] ) ? $config['leads'] : null,
						);
					},
				),
			)
		);
	}
);

/** O script de visitas, do próprio plugin, só para visitantes e só com a chave configurada. */
add_action(
	'wp_enqueue_scripts',
	function () {
		$config = superelements_config();
		$file   = plugin_dir_path( __FILE__ ) . 'assets/visitas.js';
		if ( empty( $config['tracker']['key'] ) || empty( $config['tracker']['endpoint'] ) || ! file_exists( $file ) ) {
			return;
		}
		if ( is_admin() || is_customize_preview() || is_user_logged_in() ) {
			return;
		}
		wp_enqueue_script( 'superelements-visitas', plugins_url( 'assets/visitas.js', __FILE__ ), array(), filemtime( $file ), array( 'in_footer' => true, 'strategy' => 'defer' ) );
	}
);

add_filter(
	'script_loader_tag',
	function ( $tag, $handle ) {
		if ( 'superelements-visitas' !== $handle ) {
			return $tag;
		}
		$config = superelements_config();
		return str_replace(
			' src=',
			' data-site="' . esc_attr( $config['tracker']['key'] ) . '" data-endpoint="' . esc_url( $config['tracker']['endpoint'] ) . '" src=',
			$tag
		);
	},
	10,
	2
);
