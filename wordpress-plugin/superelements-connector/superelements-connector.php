<?php
/**
 * Plugin Name: Superelements Connector
 * Description: Deixa a plataforma Superelements gravar o SEO do Yoast em páginas e publicar o cabeçalho, o rodapé e os componentes do site como modelos do Elementor, pela API do WordPress.
 * Version: 0.2.0
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
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const SUPERELEMENTS_CONNECTOR_VERSION = '0.2.0';

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
